// src/index.ts
// SaaS予約MVP + 競合防止(Durable Objects) + 入力正規化 + 管理コマンド + CSVエクスポート
// そのまま貼り替えOK。Webhookは /api/line/webhook、CSVは /api/export?ym=YYYY-MM で配布。

export interface Env {
  LINE_BOOKING: KVNamespace;
  SLOT_LOCK: DurableObjectNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string; // wrangler secret
  BASE_URL?: string;                 // 例: https://saas-api.example.workers.dev
}

const TZ = "Asia/Tokyo";

// ===================== エラーヘルパ（1101対策のログ用） =====================
function toPlainError(e: unknown) {
  if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack };
  try { return { note: "non-error throw", value: JSON.stringify(e) }; }
  catch { return { note: "non-error throw (unserializable)" }; }
}

// ========================= Durable Object: SlotLock =========================
export class SlotLock {
  state: DurableObjectState;
  constructor(state: DurableObjectState) {
    this.state = state;
  }
  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire") {
      const ttl = parseInt(url.searchParams.get("ttl") || "15", 10);
      const locked = await this.state.storage.get("lock");
      if (locked) return new Response("locked", { status: 423 });
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

async function acquireSlotLock(env: Env, key: string, ttlSec = 15) {
  const id = env.SLOT_LOCK.idFromName(key);
  const stub = env.SLOT_LOCK.get(id);
  const r = await stub.fetch(`https://lock/acquire?ttl=${ttlSec}`, { method: "POST" });
  if (r.status === 423) throw new Error("LOCKED");
}
async function releaseSlotLock(env: Env, key: string) {
  const id = env.SLOT_LOCK.idFromName(key);
  const stub = env.SLOT_LOCK.get(id);
  await stub.fetch(`https://lock/release`, { method: "POST" }).catch(() => {});
}

// =============================== Utils =====================================
function jstNow(): Date {
  const s = new Date().toLocaleString("en-US", { timeZone: TZ });
  return new Date(s);
}
function isPastJst(date: string, time: string): boolean {
  const d = new Date(`${date}T${time}:00+09:00`);
  return d.getTime() < jstNow().getTime();
}
function uniq(arr: string[]) {
  return [...new Set(arr)];
}
function isYmd(s: string) { return /^\d{4}-\d{2}-\d{2}$/.test(s); }
function isYm(s: string)  { return /^\d{4}-(0[1-9]|1[0-2])$/.test(s); }
function fmtSlotsMessage(date: string, opens: string[], env: Env) {
  return [
    `📅 ${date} の空き状況`,
    `空き: ${opens.length ? opens.join(", ") : "なし"}`,
  ].join("\n");
}
// LINE Quick Reply（最低限）
function quickActions() {
  return {
    items: [
      { type: "action", action: { type: "message", label: "空き枠を見る", text: "/slots 今日" } },
      { type: "action", action: { type: "message", label: "予約する", text: "/reserve 2025-10-05 16:30 カット" } },
      { type: "action", action: { type: "message", label: "自分の予約", text: "/my" } },
      { type: "action", action: { type: "message", label: "予約取消", text: "/cancel 2025-10-05 16:30" } },
    ],
  };
}

// ======================= 入力正規化 & パース ===============================
type Parsed = { date: string; time: string; service: string };

function normalizeAndParseReserve(text: string, defaultService = "カット"): Parsed | null {
  // 全角→半角、空白正規化
  const z = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  // /reserve 2025-10-05 16:30 カラー
  const m = z.match(/(?:^\/?reserve\s+)?(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2})[:：](\d{2})(?:\s+(.+))?$/i);
  if (!m) return null;
  const yyyy = m[1];
  const mm = m[2].padStart(2, "0");
  const dd = m[3].padStart(2, "0");
  const hh = m[4].padStart(2, "0");
  const mi = m[5].padStart(2, "0");
  const service = (m[6]?.trim()) || defaultService;
  return { date: `${yyyy}-${mm}-${dd}`, time: `${hh}:${mi}`, service };
}
function normalizeDateArg(s: string): string | null {
  const z = s.normalize("NFKC").replace(/\s+/g, " ").trim();
  if (z === "今日" || z === "today") {
    const now = jstNow();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  // 2025/10/5 → 2025-10-05
  const m = z.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) {
    const yyyy = m[1], mm = m[2].padStart(2, "0"), dd = m[3].padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return isYmd(z) ? z : null;
}

// ========================== KV Keys ==========================
const K_SLOTS = (date: string) => `S:${date}`;                      // JSON string[] times
const K_RES   = (date: string, time: string) => `R:${date} ${time}`; // JSON { userId, userName, service, ts }
const K_USER  = (uid: string, date: string, time: string) => `U:${uid}:${date} ${time}`;

// ======================= LINE REST Helpers ===================
async function lineReply(env: Env, replyToken: string, text: string) {
  const body = {
    replyToken,
    messages: [{ type: "text", text, quickReply: quickActions() }],
  };
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

// ============================ Handlers ============================
async function handleSetSlots(env: Env, args: string[], replyToken: string) {
  // /set-slots 2025-10-05 10:00,11:00,16:30
  if (args.length < 2) return lineReply(env, replyToken, "使い方：/set-slots YYYY-MM-DD 10:00,11:00,16:30");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");

  const times = uniq(args[1].split(",").map(s => s.trim())).filter(Boolean);
  await env.LINE_BOOKING.put(K_SLOTS(date), JSON.stringify(times));
  return lineReply(env, replyToken, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`);
}

async function handleSlots(env: Env, args: string[], replyToken: string) {
  // /slots 2025-10-05 | /slots 今日
  if (args.length < 1) return lineReply(env, replyToken, "使い方：/slots YYYY-MM-DD 例）/slots 今日");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");

  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.length) return lineReply(env, replyToken, `⚠️ ${date} の枠は未設定だよ。/set-slots で入れてね。`);
  // 予約済みを除外して「空き」を出す
  const reserved = await env.LINE_BOOKING.list({ prefix: `R:${date} ` });
  const reservedTimes = new Set(reserved.keys.map(k => k.name.substring(`R:${date} `.length)));
  const opens = slots.filter(t => !reservedTimes.has(t));
  return lineReply(env, replyToken, fmtSlotsMessage(date, opens, env));
}

async function handleReserve(env: Env, text: string, replyToken: string, userId: string, userName: string | undefined) {
  // /reserve 2025-10-05 16:30 [サービス]
  const parsed = normalizeAndParseReserve(text, "カット");
  if (!parsed) return lineReply(env, replyToken, "例）/reserve 2025-10-05 16:30 カット");
  const { date, time, service } = parsed;
  if (isPastJst(date, time)) return lineReply(env, replyToken, "過去の時間は予約できないよ🙏");

  // 枠に存在するか
  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.includes(time)) return lineReply(env, replyToken, `その時間は枠にないよ。\nまず /slots ${date} で確認してね`);

  const slotKey = `${date} ${time}`;

  try {
    // 二重予約ゼロ化（並行アクセスでも1件だけ通す）
    await acquireSlotLock(env, slotKey, 15);

    const exists = await env.LINE_BOOKING.get(K_RES(date, time));
    if (exists) return lineReply(env, replyToken, "ごめん！その枠はちょうど埋まっちゃった🙏 他の時間を試してね。");

    const rec = { userId, userName, service, date, time, ts: Date.now() };
    await env.LINE_BOOKING.put(K_RES(date, time), JSON.stringify(rec));
    await env.LINE_BOOKING.put(K_USER(userId, date, time), "1");

    return lineReply(env, replyToken, `✅ 予約を登録したよ。\n日時: ${date} ${time}\n内容: ${service}`);
  } catch (e: any) {
    if (e?.message === "LOCKED") {
      return lineReply(env, replyToken, "同時に予約が集中してるよ！ 少し待ってもう一度だけ試してね🙏");
    }
    throw e;
  } finally {
    await releaseSlotLock(env, slotKey);
  }
}

async function handleMy(env: Env, args: string[], replyToken: string, userId: string) {
  // /my | /my 2025-10-05 | /my 2025-10
  const q = args[0]?.trim();
  let lines: string[] = [];
  if (!q) {
    // 未来の予約一覧
    const prefix = `U:${userId}:`;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
    const now = jstNow().getTime();
    const items: { date: string; time: string; }[] = [];
    for (const k of list.keys) {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      if (!m) continue;
      const date = m[1], time = m[2];
      const when = new Date(`${date}T${time}:00+09:00`).getTime();
      if (when >= now) items.push({ date, time });
    }
    items.sort((a, b) => (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
    lines = items.map(i => `・${i.date} ${i.time}`);
    return lineReply(env, replyToken, lines.length ? `あなたの予約\n${lines.join("\n")}` : "あなたの予約はないよ🗓️");
  }

  if (isYmd(q)) {
    const prefix = `U:${userId}:${q} `;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 100 });
    lines = list.keys.map(k => `・${q} ${k.name.substring(prefix.length)}`);
    return lineReply(env, replyToken, lines.length ? `あなたの予約\n${lines.join("\n")}` : "その日の予約はないよ🗓️");
  }

  if (isYm(q)) {
    const prefix = `U:${userId}:${q}-`;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
    lines = list.keys.map(k => {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      if (!m) return "";
      return `・${m[1]} ${m[2]}`;
    }).filter(Boolean);
    return lineReply(env, replyToken, lines.length ? `あなたの予約（${q}）\n${lines.join("\n")}` : "その月の予約はないよ🗓️");
  }

  return lineReply(env, replyToken, "使い方：/my（未来の予約一覧） | /my 2025-10-05 | /my 2025-10");
}

async function handleCancel(env: Env, args: string[], replyToken: string, userId: string) {
  // /cancel 2025-10-05 16:30 [サービスは任意]
  if (args.length < 2) return lineReply(env, replyToken, "使い方：/cancel YYYY-MM-DD HH:MM");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");
  const time = args[1].normalize("NFKC");
  const recStr = await env.LINE_BOOKING.get(K_RES(date, time));
  if (!recStr) return lineReply(env, replyToken, "その枠の予約は見つからないよ。");
  const rec = JSON.parse(recStr);
  if (rec.userId !== userId) return lineReply(env, replyToken, "この予約はあなたのものじゃないみたい🥲");

  await env.LINE_BOOKING.delete(K_RES(date, time));
  await env.LINE_BOOKING.delete(K_USER(userId, date, time));
  return lineReply(env, replyToken, `✅ 予約をキャンセルしたよ。\n日時: ${date} ${time}`);
}

async function handleListAdmin(env: Env, args: string[], replyToken: string) {
  // /list 2025-10-05
  if (args.length < 1) return lineReply(env, replyToken, "使い方：/list YYYY-MM-DD");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");
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
  return lineReply(env, replyToken, rows.length
    ? "【当日の予約】\n" + rows.map(r => `・${r.time} ${r.service}（${r.userId}）`).join("\n")
    : "その日の予約はまだ無いよ🗓️");
}

async function handleExportMonth(env: Env, args: string[], replyToken: string, origin: string) {
  // /export 2025-10 → CSVダウンロードURL返す
  if (args.length < 1) return lineReply(env, replyToken, "使い方：/export YYYY-MM");
  const ym = args[0].normalize("NFKC");
  if (!isYm(ym)) return lineReply(env, replyToken, "月の形式が変だよ（例：2025-10）");
  const base = env.BASE_URL || origin;
  const url = `${base.replace(/\/$/, "")}/api/export?ym=${encodeURIComponent(ym)}`;
  return lineReply(env, replyToken, `📦 CSVを作ったよ！\n${url}\nブラウザで開いてダウンロードしてね。`);
}

// ============================ HTTP Export（安全・非ストリーミング版） ============================
async function handleHttpExport(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const ym = (url.searchParams.get("ym") || "").trim();
  if (!isYm(ym)) {
    return new Response("bad request (use ?ym=YYYY-MM)", {
      status: 400,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }

  const esc = (s: unknown) => {
    let t = s == null ? "" : String(s);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };

  let csv = "date,time,userId,userName,service,raw\n";
  const prefix = `R:${ym}-`;

  try {
    let cursor: string | undefined = undefined;

    for (;;) {
      const opts: Record<string, unknown> = { prefix, limit: 1000 };
      if (cursor) opts.cursor = cursor;

      const page = await env.LINE_BOOKING.list(opts as any);

      for (const { name } of page.keys) {
        // name: R:YYYY-MM-DD HH:MM
        const m = /^R:(\d{4}-\d{2}-\d{2})\s(\d{2}:\d{2})$/.exec(name);
        const date = m?.[1] ?? "";
        const time = m?.[2] ?? "";

        let raw = "";
        try {
          raw = (await env.LINE_BOOKING.get(name)) ?? "";
        } catch (e) {
          console.error("KV_GET_FAIL", toPlainError(e), { name });
          raw = "";
        }

        let userId = "", userName = "", service = "";
        if (raw) {
          try {
            const rec = JSON.parse(raw);
            userId = String(rec.userId ?? "");
            userName = String(rec.userName ?? "");
            service = String(rec.service ?? "");
          } catch {
            // JSONでなくてもOK（rawにそのまま入る）
          }
        }

        csv += `${date},${time},${esc(userId)},${esc(userName)},${esc(service)},${esc(raw)}\n`;
      }

      if (page.list_complete) break;
      cursor = page.cursor;
    }

    return new Response(csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="booking-${ym}.csv"`,
        "cache-control": "no-store",
      },
    });

  } catch (e) {
    console.error("EXPORT_TOP_FAIL", toPlainError(e), { ym });
    return new Response("Internal Server Error", {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
}

// ============================ Router ============================
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);

      // CSVダウンロード
      if (url.pathname === "/api/export" && req.method === "GET") {
        return await handleHttpExport(req, env);
      }

      // LINE Webhook
      if (url.pathname === "/api/line/webhook" && req.method === "POST") {
        const body = await req.json<any>().catch(() => ({ events: [] }));
        const events = body.events || [];
        for (const ev of events) {
          const replyToken: string | undefined = ev.replyToken;
          const messageText: string | undefined = ev.message?.text;
          const userId: string | undefined = ev.source?.userId;
          const userName: string | undefined = ev.source?.userId; // 必要ならプロフィールAPIで取得

          if (!replyToken || !messageText || !userId) continue;

          // コマンド判定
          const z = messageText.normalize("NFKC").trim();
          const [cmdRaw, ...rest] = z.split(" ");
          const cmd = cmdRaw.toLowerCase();

          try {
            if (cmd === "/set-slots" || cmd === "set-slots") {
              await handleSetSlots(env, rest, replyToken);
            } else if (cmd === "/slots" || cmd === "slots") {
              await handleSlots(env, rest, replyToken);
            } else if (cmd === "/reserve" || cmd === "reserve") {
              await handleReserve(env, z, replyToken, userId, userName);
            } else if (cmd === "/my" || cmd === "my") {
              await handleMy(env, rest, replyToken, userId);
            } else if (cmd === "/cancel" || cmd === "cancel") {
              await handleCancel(env, rest, replyToken, userId);
            } else if (cmd === "/list" || cmd === "list") {
              await handleListAdmin(env, rest, replyToken);
            } else if (cmd === "/export" || cmd === "export") {
              const origin = `${url.protocol}//${url.host}`;
              await handleExportMonth(env, rest, replyToken, origin);
            } else {
              // それ以外はガイド表示
              await lineReply(env, replyToken,
                [
                  "使えるコマンド👇",
                  "/set-slots YYYY-MM-DD 10:00,11:00,16:30",
                  "/slots YYYY-MM-DD",
                  "/reserve YYYY-MM-DD HH:MM [サービス]",
                  "/my [YYYY-MM-DD|YYYY-MM]",
                  "/cancel YYYY-MM-DD HH:MM",
                  "/list YYYY-MM-DD",
                  "/export YYYY-MM",
                ].join("\n")
              );
            }
          } catch (e) {
            await lineReply(env, replyToken, "内部エラーが起きたかも🙏 もう一度試してみてね。");
            console.error(e);
          }
        }
        return new Response("OK");
      }

      // 動作確認
      if (url.pathname === "/" && req.method === "GET") {
        return new Response("OK / SaaS Booking Worker");
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      // 最終防衛：必ずHTTP応答を返す（= 1101回避）
      console.error("UNCAUGHT_FETCH_ERROR", toPlainError(e), { url: (req as any)?.url });
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
