// src/index.ts
// SaaS予約（CSVなし）
// Webhook: /api/line/webhook
// Health:  /__health

export interface Env {
  LINE_BOOKING: KVNamespace;
  SLOT_LOCK: DurableObjectNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string; // wrangler secret
  BASE_URL?: string;
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

const quickActions = () => ({
  items: [
    { type: "action", action: { type: "message", label: "空き枠を見る", text: "/slots 今日" } },
    { type: "action", action: { type: "message", label: "予約する",   text: "/reserve 2025-10-05 16:30 カット" } },
    { type: "action", action: { type: "message", label: "自分の予約", text: "/my" } },
    { type: "action", action: { type: "message", label: "予約取消",   text: "/cancel 2025-10-05 16:30" } },
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
  [`📅 ${date} の空き状況`, `空き: ${opens.length ? opens.join(", ") : "なし"}`].join("\n");

// =============== 入力正規化 ===============
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
  if (args.length < 2) return lineReply(env, replyToken, "使い方：/set-slots YYYY-MM-DD 10:00,11:00,16:30");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");
  const times = uniq(args[1].split(",").map(s => s.trim())).filter(Boolean);
  await env.LINE_BOOKING.put(K_SLOTS(date), JSON.stringify(times));
  return lineReply(env, replyToken, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`);
}

async function handleSlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return lineReply(env, replyToken, "使い方：/slots YYYY-MM-DD（例：/slots 今日）");
  const date = normalizeDateArg(args[0]);
  if (!date) return lineReply(env, replyToken, "日付の形式が変だよ（例：2025-10-05）");

  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.length) return lineReply(env, replyToken, `⚠️ ${date} の枠は未設定だよ。/set-slots で入れてね。`);

  const reserved = await env.LINE_BOOKING.list({ prefix: `R:${date} ` });
  const taken = new Set(reserved.keys.map(k => k.name.substring(`R:${date} `.length)));
  const opens = slots.filter(t => !taken.has(t));
  return lineReply(env, replyToken, fmtSlots(date, opens));
}

async function handleReserve(env: Env, z: string, replyToken: string, userId: string, userName?: string) {
  const p = parseReserve(z, "カット");
  if (!p) return lineReply(env, replyToken, "例）/reserve 2025-10-05 16:30 カット");
  const { date, time, service } = p;
  if (isPast(date, time)) return lineReply(env, replyToken, "過去の時間は予約できないよ🙏");

  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.includes(time)) return lineReply(env, replyToken, `その時間は枠にないよ。\nまず /slots ${date} で確認してね`);

  const key = `${date} ${time}`;
  try {
    await acquire(env, key, 15);
    if (await env.LINE_BOOKING.get(K_RES(date, time))) {
      return lineReply(env, replyToken, "ごめん！その枠はちょうど埋まっちゃった🙏 他の時間を試してね。");
    }
    const rec = { userId, userName, service, date, time, ts: Date.now() };
    await env.LINE_BOOKING.put(K_RES(date, time), JSON.stringify(rec));
    await env.LINE_BOOKING.put(K_USER(userId, date, time), "1");
    return lineReply(env, replyToken, `✅ 予約を登録したよ。\n日時: ${date} ${time}\n内容: ${service}`);
  } catch (e: any) {
    if (e?.message === "LOCKED") return lineReply(env, replyToken, "同時に予約が集中してるよ！ 少し待ってもう一度だけ試してね🙏");
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
    return lineReply(env, replyToken, items.length ? `あなたの予約\n${items.map(i => `・${i.date} ${i.time}`).join("\n")}` : "あなたの予約はないよ🗓️");
  }

  if (isYmd(q)) {
    const prefix = `U:${userId}:${q} `;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 100 });
    const lines = list.keys.map(k => `・${q} ${k.name.substring(prefix.length)}`);
    return lineReply(env, replyToken, lines.length ? `あなたの予約\n${lines.join("\n")}` : "その日の予約はないよ🗓️");
  }

  if (isYm(q)) {
    const prefix = `U:${userId}:${q}-`;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
    const lines = list.keys.map(k => {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      return m ? `・${m[1]} ${m[2]}` : "";
    }).filter(Boolean);
    return lineReply(env, replyToken, lines.length ? `あなたの予約（${q}）\n${lines.join("\n")}` : "その月の予約はないよ🗓️");
  }

  return lineReply(env, replyToken, "使い方：/my（未来の予約一覧） | /my 2025-10-05 | /my 2025-10");
}

async function handleCancel(env: Env, args: string[], replyToken: string, userId: string) {
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

async function handleList(env: Env, args: string[], replyToken: string) {
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
  return lineReply(env, replyToken,
    rows.length ? "【当日の予約】\n" + rows.map(r => `・${r.time} ${r.service}（${r.userId}）`).join("\n")
                : "その日の予約はまだ無いよ🗓️");
}

// =============== Router ===============
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/__health") return new Response("ok");

    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      const body = await req.json<any>().catch(() => ({ events: [] }));
      const events = body.events || [];
      for (const ev of events) {
        const replyToken: string | undefined = ev.replyToken;
        const messageText: string | undefined = ev.message?.text;
        const userId: string | undefined = ev.source?.userId;
        const userName: string | undefined = ev.source?.userId; // 必要ならプロフィールAPIへ
        if (!replyToken || !messageText || !userId) continue;

        const z = messageText.normalize("NFKC").trim();
        const [cmdRaw, ...rest] = z.split(" ");
        const cmd = cmdRaw.toLowerCase();

        try {
          if (cmd === "/set-slots" || cmd === "set-slots") await handleSetSlots(env, rest, replyToken);
          else if (cmd === "/slots"  || cmd === "slots")    await handleSlots(env, rest, replyToken);
          else if (cmd === "/reserve"|| cmd === "reserve")  await handleReserve(env, z, replyToken, userId, userName);
          else if (cmd === "/my"     || cmd === "my")       await handleMy(env, rest, replyToken, userId);
          else if (cmd === "/cancel" || cmd === "cancel")   await handleCancel(env, rest, replyToken, userId);
          else if (cmd === "/list"   || cmd === "list")     await handleList(env, rest, replyToken);
          else {
            await lineReply(env, replyToken, [
              "使えるコマンド👇",
              "/set-slots YYYY-MM-DD 10:00,11:00,16:30",
              "/slots YYYY-MM-DD",
              "/reserve YYYY-MM-DD HH:MM [サービス]",
              "/my [YYYY-MM-DD|YYYY-MM]",
              "/cancel YYYY-MM-DD HH:MM",
              "/list YYYY-MM-DD",
            ].join("\n"));
          }
        } catch {
          await lineReply(env, replyToken, "内部エラーが起きたかも🙏 もう一度試してみてね。");
        }
      }
      return new Response("OK");
    }

    if (url.pathname === "/" && req.method === "GET") {
      return new Response("OK / SaaS Booking Worker");
    }

    return new Response("Not Found", { status: 404 });
  },
};
