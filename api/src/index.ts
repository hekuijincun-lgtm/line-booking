// src/index.ts
// SaaS予約（CSVなし） + 署名検証 + 管理者限定 + RateLimit + /copy-slots + /report
// パッチ:
//  - /set-slots が「スペース/カンマ/全角」区切りの両対応
//  - /list が「YYYY-MM」(月指定) に対応（登録/予約/空き｜先頭の空き）
//  - RateLimit の TTL が窓の終端まで固定化
//  - /whoami が 1:1 / group / room でプロフ取得に対応
// Webhook: /api/line/webhook
// Health:  /__health

export interface Env {
  LINE_BOOKING: KVNamespace;
  SLOT_LOCK: DurableObjectNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string; // wrangler secret
  LINE_CHANNEL_SECRET: string;       // 署名検証で使用（必須）
  ADMINS?: string;                   // "Uxxxx, Uyyyy" カンマ区切り
  BASE_URL?: string;
  SLACK_WEBHOOK_URL?: string;        // 任意
}

const TZ = "Asia/Tokyo";

// =============== Helpers ===============
const nowJST = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
const isPast = (date: string, time: string) =>
  new Date(`${date}T${time}:00+09:00`).getTime() < nowJST().getTime();
const uniq = (a: string[]) => [...new Set(a)];
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isYm  = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

const K_SLOTS = (date: string) => `S:${date}`;
const K_RES   = (date: string, time: string) => `R:${date} ${time}`;
const K_USER  = (uid: string, date: string, time: string) => `U:${uid}:${date} ${time}`;

// 管理者判定
function isAdmin(uid: string, env: Env) {
  const list = (env.ADMINS || "").split(",").map(s => s.trim()).filter(Boolean);
  return list.includes(uid);
}

// LINE署名検証
function toBase64(ab: ArrayBuffer): string {
  let s = ""; const v = new Uint8Array(ab);
  for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
  return btoa(s);
}
async function verifyLineSignature(req: Request, env: Env, raw: string): Promise<boolean> {
  const sig = req.headers.get("x-line-signature") || "";
  if (!sig || !env.LINE_CHANNEL_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return sig === toBase64(mac);
}

// RateLimit（uidごと 秒窓）: 窓の終端まで TTL を維持
async function rateLimit(env: Env, uid: string, limit = 10, windowSec = 60) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSec) * windowSec;
  const ttl = windowStart + windowSec - now; // その窓の残り秒数
  const bucket = `RL:${uid}:${Math.floor(now / windowSec)}`;
  const current = parseInt((await env.LINE_BOOKING.get(bucket)) || "0", 10) + 1;
  await env.LINE_BOOKING.put(bucket, String(current), { expirationTtl: Math.max(ttl, 1) });
  return current <= limit;
}

const quickActions = () => ({
  items: [
    { type: "action", action: { type: "message", label: "空き枠を見る", text: "/slots 今日" } },
    { type: "action", action: { type: "message", label: "予約する",   text: "/reserve 2025-10-05 16:30 カット" } },
    { type: "action", action: { type: "message", label: "自分の予約", text: "/my" } },
    { type: "action", action: { type: "message", label: "予約取消",   text: "/cancel 2025-10-05 16:30" } },
    { type: "action", action: { type: "message", label: "自分のID",   text: "/whoami" } },
  ],
});

const lineReply = async (env: Env, replyToken: string, text: string) => {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text, quickReply: quickActions() }] }),
  }).catch(() => {});
};

const fmtSlots = (date: string, opens: string[]) =>
  [`[SLOTS] ${date} の空き状況`, `空き: ${opens.length ? opens.join(", ") : "なし"}`].join("\n");

// --- Slack 通知（任意; URL 未設定なら何もしない） ---
async function notifySlack(env: Env, title: string, payload: any) {
  const url = env.SLACK_WEBHOOK_URL || "";
  if (!url) return;
  const body = { text: `*[${title}]*\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`` };
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .catch(() => {});
}

// =============== 入力正規化 ===============
// 時刻の柔軟パーサ（スペース/カンマ/全角区切り、10 または 10:30 などを許容）
function parseTimesFlexible(tokens: string[]): string[] {
  const joined = tokens.join(" ")
    .replace(/[、，]/g, ",")   // 全角カンマ→半角
    .replace(/\s+/g, " ");     // スペース正規化（全角含む）
  const parts = joined.split(/[ ,]+/).map(s => s.trim()).filter(Boolean);
  const norm = (t: string) => {
    const m = t.match(/^(\d{1,2})(?::|：)?(\d{2})?$/);
    if (!m) return null;
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const mi = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  };
  return Array.from(new Set(parts.map(norm).filter(Boolean) as string[])).sort();
}

type Parsed = { date: string; time: string; service: string };

function normalizeDateArg(s: string): string | null {
  const z = s.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (z === "今日" || z.toLowerCase() === "today") {
    const d = nowJST();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const m = z.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return isYmd(z) ? z : null;
}

function normalizeMonthArg(s: string): string | null {
  const z = s.normalize("NFKC").trim().replace(/[／．.]/g, "-");
  const m = z.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return isYm(z) ? z : null;
}

function parseReserve(text: string, defaultService = "カット"): Parsed | null {
  const z = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const m = z.match(/(?:^\/?reserve\s+)?(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2})[:：](\d{2})(?:\s+(.+))?$/i);
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = `${m[4].padStart(2, "0")}:${m[5].padStart(2, "0")}`;
  const service = (m[6]?.trim()) || defaultService;
  return { date, time, service };
}

// =============== Durable Object ===============
export class SlotLock {
  constructor(private state: DurableObjectState) {}
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire") {
      const ttl = parseInt(url.searchParams.get("ttl") || "15", 10);
      if (await this.state.storage.get("lock")) return new Response("locked", { status: 423 });
      await this.state.storage.put("lock", "1", { expirationTtl: ttl });
      return new Response("ok");
    }
    if (url.pathname === "/release") {
      await this.state.storage.delete("lock");
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }
}
async function acquire(env: Env, key: string, ttlSec = 15) {
  const id = env.SLOT_LOCK.idFromName(key);
  const r = await env.SLOT_LOCK.get(id).fetch("https://lock/acquire?ttl=" + ttlSec, { method: "POST" });
  if (r.status === 423) throw new Error("LOCKED");
}
async function release(env: Env, key: string) {
  const id = env.SLOT_LOCK.idFromName(key);
  await env.SLOT_LOCK.get(id).fetch("https://lock/release", { method: "POST" }).catch(() => {});
}

// =============== Handlers ===============
async function handleSetSlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 2) return lineReply(env, replyToken, "使い方: /set-slots YYYY-MM-DD 10:00,11:00,16:30");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例: 2025-10-05）");
  const times = parseTimesFlexible(args.slice(1));
  if (!times.length) return lineReply(env, replyToken, "時刻の指定が見つからないよ（例: 10:00 10:30 11:00）");
  await env.LINE_BOOKING.put(K_SLOTS(date), JSON.stringify(times));
  return lineReply(env, replyToken, `OK: ${date} の枠を更新したよ。\n${times.join(", ")}`);
}

async function handleSlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return lineReply(env, replyToken, "使い方: /slots YYYY-MM-DD（例: /slots 今日）");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例: 2025-10-05）");

  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.length) return lineReply(env, replyToken, `[WARN] ${date} の枠は未設定だよ。/set-slots で入れてね。`);

  const reserved = await env.LINE_BOOKING.list({ prefix: `R:${date} ` });
  const taken = new Set(reserved.keys.map(k => k.name.substring(`R:${date} `.length)));
  const opens = slots.filter(t => !taken.has(t));
  return lineReply(env, replyToken, fmtSlots(date, opens));
}

async function handleReserve(env: Env, z: string, replyToken: string, userId: string, userName?: string) {
  const p = parseReserve(z, "カット");
  if (!p) return lineReply(env, replyToken, "例）/reserve 2025-10-05 16:30 カット");
  const { date, time, service } = p;
  if (isPast(date, time)) return lineReply(env, replyToken, "過去の時間は予約できないよ。");

  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.includes(time)) return lineReply(env, replyToken, `その時間は枠にないよ。\nまず /slots ${date} で確認してね。`);

  const key = `${date} ${time}`;
  try {
    await acquire(env, key, 15);
    if (await env.LINE_BOOKING.get(K_RES(date, time))) {
      return lineReply(env, replyToken, "ごめん！その枠はちょうど埋まっちゃった。他の時間を試してね。");
    }
    const rec = { userId, userName, service, date, time, ts: Date.now() };
    await env.LINE_BOOKING.put(K_RES(date, time), JSON.stringify(rec));
    await env.LINE_BOOKING.put(K_USER(userId, date, time), "1");
    return lineReply(env, replyToken, `OK: 予約を登録したよ。\n日時: ${date} ${time}\n内容: ${service}`);
  } catch (e: any) {
    if (e?.message === "LOCKED") return lineReply(env, replyToken, "同時に予約が集中してるよ。少しだけ置いて再試行してね。");
    await notifySlack(env, "RESERVE_FAIL", { date, time, userId, err: e?.message || String(e) });
    throw e;
  } finally {
    await release(env, key);
  }
}

async function handleMy(env: Env, args: string[], replyToken: string, userId: string) {
  const q = args[0]?.trim();
  if (!q) {
    const list = await env.LINE_BOOKING.list({ prefix: `U:${userId}:`, limit: 1000 });
    const now = nowJST().getTime();
    const items: { date: string; time: string }[] = [];
    for (const k of list.keys) {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      if (!m) continue;
      const when = new Date(`${m[1]}T${m[2]}:00+09:00`).getTime();
      if (when >= now) items.push({ date: m[1], time: m[2] });
    }
    items.sort((a, b) => (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
    return lineReply(env, replyToken, items.length ? `あなたの予約\n${items.map(i => `・${i.date} ${i.time}`).join("\n")}` : "あなたの予約はないよ。");
  }

  if (isYmd(q)) {
    const prefix = `U:${userId}:${q} `;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 100 });
    const lines = list.keys.map(k => `・${q} ${k.name.substring(prefix.length)}`);
    return lineReply(env, replyToken, lines.length ? `あなたの予約\n${lines.join("\n")}` : "その日の予約はないよ。");
  }

  if (isYm(q)) {
    const prefix = `U:${userId}:${q}-`;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
    const lines = list.keys.map(k => {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      return m ? `・${m[1]} ${m[2]}` : "";
    }).filter(Boolean);
    return lineReply(env, replyToken, lines.length ? `あなたの予約（${q}）\n${lines.join("\n")}` : "その月の予約はないよ。");
  }

  return lineReply(env, replyToken, "使い方: /my（未来の予約一覧） | /my 2025-10-05 | /my 2025-10");
}

async function handleCancel(env: Env, args: string[], replyToken: string, userId: string) {
  if (args.length < 2) return lineReply(env, replyToken, "使い方: /cancel YYYY-MM-DD HH:MM");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例: 2025-10-05）");
  const time = args[1].normalize("NFKC");
  const recStr = await env.LINE_BOOKING.get(K_RES(date, time));
  if (!recStr) return lineReply(env, replyToken, "その枠の予約は見つからないよ。");
  const rec = JSON.parse(recStr);
  if (rec.userId !== userId) return lineReply(env, replyToken, "この予約はあなたのものじゃないみたい。");

  await env.LINE_BOOKING.delete(K_RES(date, time));
  await env.LINE_BOOKING.delete(K_USER(userId, date, time));
  return lineReply(env, replyToken, `OK: 予約をキャンセルしたよ。\n日時: ${date} ${time}`);
}

// =============== 月別一覧（登録/予約/空き｜先頭の空き） ===============
function daysInMonth(y: number, m: number): number {
  return new Date(y, m, 0).getDate();
}
function dayOfWeekTag(y: number, m: number, d: number): string {
  const w = new Date(y, m - 1, d).getDay();
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][w];
}

async function listMonth(env: Env, ym: string, replyToken: string) {
  // ym = "2025-10"
  const [yy, mm] = ym.split("-").map(Number);
  if (!yy || !mm || mm < 1 || mm > 12) {
    return lineReply(env, replyToken, "形式: /list YYYY-MM だよ（例: /list 2025-10）");
    }
  const last = daysInMonth(yy, mm);
  const lines: string[] = [];
  const header = `[MONTH] ${ym} の枠一覧（登録/予約/空き｜先頭の空き）`;

  for (let d = 1; d <= last; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;

    // 登録済みスロット
    const raw = await env.LINE_BOOKING.get(K_SLOTS(date));
    const slots: string[] = raw ? JSON.parse(raw) : [];

    // 予約済み（R:YYYY-MM-DD HH:MM）
    const it = await env.LINE_BOOKING.list({ prefix: `R:${date} `, limit: 1000 });
    const taken = new Set(it.keys.map(k => k.name.substring(`R:${date} `.length)));

    const total = slots.length;
    const reserved = slots.filter(t => taken.has(t)).length;
    const free = Math.max(total - reserved, 0);
    const firstFree = slots.find(t => !taken.has(t));

    const dow = dayOfWeekTag(yy, mm, d);
    lines.push(`${dow} ${date} ｜ ${total}/${reserved}/${free}${firstFree ? `｜→ ${firstFree}` : ""}`);
  }

  return lineReply(env, replyToken, [header, ...lines].join("\n"));
}

// =============== /list（日 or 月） ===============
async function handleList(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return lineReply(env, replyToken, "使い方: /list YYYY-MM-DD | YYYY-MM");
  const arg = args[0];

  // 月指定
  const month = normalizeMonthArg(arg);
  if (month) return listMonth(env, month, replyToken);

  // 日指定
  const date = normalizeDateArg(arg);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例: 2025-10-05 または 2025-10）");

  const prefix = `R:${date} `;
  const it = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
  const rows: { time: string; userId: string; service: string }[] = [];
  for (const k of it.keys) {
    const v = await env.LINE_BOOKING.get(k.name);
    if (!v) continue;
    const r = JSON.parse(v);
    rows.push({ time: k.name.substring(prefix.length), userId: r.userId, service: r.service });
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));
  return lineReply(
    env,
    replyToken,
    rows.length
      ? "【当日の予約】\n" + rows.map(r => `・${r.time} ${r.service}（${r.userId}）`).join("\n")
      : "その日の予約はまだ無いよ。"
  );
}

// 追加：枠コピペ
async function handleCopySlots(env: Env, args: string[], replyToken: string) {
  // /copy-slots 2025-10-05 2025-10-12
  if (args.length < 2) return lineReply(env, replyToken, "使い方: /copy-slots YYYY-MM-DD YYYY-MM-DD");
  const src = normalizeDateArg(args[0]); const dst = normalizeDateArg(args[1]);
  if (!src || !dst) return lineReply(env, replyToken, "日付の形式が変だよ（例: 2025-10-05）");
  const s = await env.LINE_BOOKING.get(K_SLOTS(src));
  const slots: string[] = s ? JSON.parse(s) : [];
  const normalized = Array.from(new Set(slots)).sort();
  await env.LINE_BOOKING.put(K_SLOTS(dst), JSON.stringify(normalized));
  return lineReply(env, replyToken, `OK: 枠をコピーしたよ。\n${src} -> ${dst}\n${normalized.join(", ")}`);
}

// 追加：月次サマリ
async function handleReport(env: Env, args: string[], replyToken: string) {
  // /report 2025-10
  if (args.length < 1) return lineReply(env, replyToken, "使い方: /report YYYY-MM");
  const ymRaw = args[0].normalize("NFKC");
  const ym = normalizeMonthArg(ymRaw);
  if (!ym) return lineReply(env, replyToken, "月の形式が変だよ（例: 2025-10）");

  const prefix = `R:${ym}-`;
  const it = await env.LINE_BOOKING.list({ prefix, limit: 2000 });
  const dayCount: Record<string, number> = {};
  const byService: Record<string, number> = {};

  for (const k of it.keys) {
    const m = /^R:(\d{4}-\d{2}-\d{2})\s(.+)$/.exec(k.name);
    if (!m) continue;
    const d = m[1]; dayCount[d] = (dayCount[d] || 0) + 1;
    const recStr = await env.LINE_BOOKING.get(k.name); if (!recStr) continue;
    try {
      const rec = JSON.parse(recStr);
      const s = String(rec.service || "未指定");
      byService[s] = (byService[s] || 0) + 1;
    } catch {}
  }

  const days = Object.entries(dayCount).sort((a,b)=>a[0].localeCompare(b[0]))
               .map(([d,c])=>`・${d} : ${c}件`).join("\n") || "（なし）";
  const svc  = Object.entries(byService).sort((a,b)=>b[1]-a[1])
               .map(([s,c])=>`・${s} : ${c}件`).join("\n") || "（なし）";
  const total = Object.values(dayCount).reduce((a,b)=>a+b,0);
  return lineReply(env, replyToken, [`【${ym} レポート】合計 ${total}件`, "— 日別 —", days, "— サービス別 —", svc].join("\n"));
}

// =============== /whoami（user / group / room 対応） ===============
function maskId(s?: string) { return s ? s.slice(0,4) + "..." + s.slice(-4) : "unknown"; }

async function whoAmI(ev: any, env: Env): Promise<string> {
  const src = ev?.source || {};
  const uid = src.userId as string | undefined;
  const gid = src.groupId as string | undefined;
  const rid = src.roomId  as string | undefined;

  if (!uid) return "whoami: userId が取れないみたい。";
  if (!env.LINE_CHANNEL_ACCESS_TOKEN) return "whoami: トークン未設定だよ。wrangler secret put LINE_CHANNEL_ACCESS_TOKEN を実行してね。";

  // エンドポイント切り替え
  let url = `https://api.line.me/v2/bot/profile/${uid}`;
  if (gid) url = `https://api.line.me/v2/bot/group/${gid}/member/${uid}`;
  if (rid) url = `https://api.line.me/v2/bot/room/${rid}/member/${uid}`;

  let prof: any = null;
  try {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` } });
    if (r.ok) prof = await r.json();
  } catch {/* ignore */}

  const out = [
    "whoami",
    `type: ${src.type || "unknown"}`,
    `userId: ${maskId(uid)}`,
    gid ? `groupId: ${maskId(gid)}` : undefined,
    rid ? `roomId: ${maskId(rid)}` : undefined,
    prof?.displayName ? `name: ${prof.displayName}` : undefined,
    prof?.language ? `lang: ${prof.language}` : undefined,
    prof?.statusMessage ? `status: ${prof.statusMessage}` : undefined,
  ].filter(Boolean).join("\n");

  return prof ? out : out + "\n（プロフィール取得に失敗。友だち関係/権限/種別を確認してね）";
}

// =============== Router ===============
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      const url = new URL(req.url);

      const FEATURES = { monthList: true, flexibleSlots: true, whoami: true } as const;
      if (url.pathname === "/__health") {
        return new Response(JSON.stringify({ ok: true, ts: Date.now(), env: env.BASE_URL || "default", features: FEATURES }), {
          headers: { "content-type": "application/json" }
        });
      }

      if (url.pathname === "/api/line/webhook" && req.method === "POST") {
        // 署名検証（生ボディで）
        const raw = await req.text();
        if (!(await verifyLineSignature(req, env, raw))) {
          await notifySlack(env, "LINE_SIGNATURE_BAD", { url: req.url });
          return new Response("unauthorized", { status: 401 });
        }
        const body = JSON.parse(raw || "{}");
        const events = body.events || [];

        for (const ev of events) {
          const replyToken: string | undefined = ev.replyToken;
          const messageText: string | undefined = ev.message?.text;
          const userId: string | undefined = ev.source?.userId;
          const userName: string | undefined = ev.source?.userId; // 実運用はプロフィールAPIへ
          if (!replyToken || !messageText || !userId) continue;

          // RateLimit
          if (!(await rateLimit(env, userId))) {
            await lineReply(env, replyToken, "リクエストが多すぎるみたい。少し待ってから試してね。");
            continue;
          }

          const z = messageText.normalize("NFKC").trim();
          const [cmdRaw, ...rest] = z.split(/\s+/); // 全角/複数スペースにも強い
          const cmd = (cmdRaw || "").toLowerCase();

          try {
            if (cmd === "/set-slots" || cmd === "set-slots") {
              if (!isAdmin(userId, env)) { await lineReply(env, replyToken, "このコマンドは管理者専用だよ。"); continue; }
              await handleSetSlots(env, rest, replyToken);

            } else if (cmd === "/slots"  || cmd === "slots") {
              await handleSlots(env, rest, replyToken);

            } else if (cmd === "/reserve"|| cmd === "reserve") {
              await handleReserve(env, z, replyToken, userId, userName);

            } else if (cmd === "/my"     || cmd === "my") {
              await handleMy(env, rest, replyToken, userId);

            } else if (cmd === "/cancel" || cmd === "cancel") {
              await handleCancel(env, rest, replyToken, userId);

            } else if (cmd === "/list"   || cmd === "list") {
              if (!isAdmin(userId, env)) { await lineReply(env, replyToken, "このコマンドは管理者専用だよ。"); continue; }
              await handleList(env, rest, replyToken);

            } else if (cmd === "/copy-slots" || cmd === "copy-slots") {
              if (!isAdmin(userId, env)) { await lineReply(env, replyToken, "このコマンドは管理者専用だよ。"); continue; }
              await handleCopySlots(env, rest, replyToken);

            } else if (cmd === "/report" || cmd === "report") {
              if (!isAdmin(userId, env)) { await lineReply(env, replyToken, "このコマンドは管理者専用だよ。"); continue; }
              await handleReport(env, rest, replyToken);

            } else if (cmd === "/whoami" || cmd === "whoami") {
              const text = await whoAmI(ev, env);
              await lineReply(env, replyToken, text);

            } else {
              await lineReply(env, replyToken, [
                "使えるコマンド",
                "/set-slots YYYY-MM-DD 10:00,11:00,16:30",
                "/slots YYYY-MM-DD",
                "/reserve YYYY-MM-DD HH:MM [サービス]",
                "/my [YYYY-MM-DD|YYYY-MM]",
                "/cancel YYYY-MM-DD HH:MM",
                "/list YYYY-MM-DD | YYYY-MM",
                "/copy-slots YYYY-MM-DD YYYY-MM-DD",
                "/report YYYY-MM",
                "/whoami",
              ].join("\n"));
            }
          } catch (e) {
            await notifySlack(env, "WEBHOOK_CMD_FAIL", { cmd, err: (e as any)?.message || String(e) });
            await lineReply(env, replyToken, "内部エラーが起きたかも。もう一度試してみてね。");
          }
        }
        return new Response("OK");
      }

      if (url.pathname === "/" && req.method === "GET") {
        return new Response("OK / SaaS Booking Worker");
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      await notifySlack(env, "UNCAUGHT_FETCH_ERROR", {
        url: (req as any)?.url,
        err: (e as any)?.message || String(e),
      });
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
