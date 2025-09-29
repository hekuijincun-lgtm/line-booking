// --- LINE Booking: minimal, robust handler -----------------------------

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

type LineEvent = {
  type: "message";
  replyToken?: string;
  deliveryContext?: { isRedelivery?: boolean };
  source?: { type?: "user" | "group" | "room"; userId?: string };
  message?: { type?: "text"; text?: string };
};

const LINE_REPLY = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH  = "https://api.line.me/v2/bot/message/push";

// ---- utils ------------------------------------------------------------

const log = (...a: any[]) => console.log("[line-booking]", ...a);

const ok = (body = "ok", init?: ResponseInit) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

// KV helpers
async function kvGetJSON<T>(kv: KVNamespace, key: string, def: T): Promise<T> {
  const v = await kv.get(key);
  if (!v) return def;
  try { return JSON.parse(v) as T; } catch { return def; }
}
async function kvPutJSON(kv: KVNamespace, key: string, v: any) {
  await kv.put(key, JSON.stringify(v));
}

// text helpers
const normDate = (s: string) => s.trim(); // 期待形式: YYYY-MM-DD
const normTime = (s: string) => s.trim(); // 期待形式: HH:mm

// LINE send (reply -> fallback push)
async function sendText(env: Env, e: LineEvent, text: string) {
  // 1) reply
  if (e.replyToken) {
    const r = await fetch(LINE_REPLY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({
        replyToken: e.replyToken,
        messages: [{ type: "text", text }],
      }),
    });
    if (r.ok) return;
    const msg = await r.text().catch(() => "");
    log("reply failed", r.status, msg);

    // 2) push fallback（userIdのみ。group/roomには仕様上不可）
    if (
      r.status === 400 ||
      r.status === 404 ||
      /Invalid reply token/i.test(msg)
    ) {
      const to = e.source?.userId;
      if (!to) { log("push skipped (no userId; group/room)"); return; }
      const p = await fetch(LINE_PUSH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          to,
          messages: [{ type: "text", text }],
        }),
      });
      if (!p.ok) log("push failed", p.status, await p.text().catch(() => ""));
    }
  }
}

// ---- domain: slots & reservations -------------------------------------

const kSlots = (date: string) => `slots:${date}`; // ["10:00","11:30",...]
const kResv  = (date: string) => `resv:${date}`;  // { "10:00": "カット" }

async function setSlots(env: Env, date: string, times: string[]) {
  const ts = times.map(normTime).filter(Boolean);
  await kvPutJSON(env.LINE_BOOKING, kSlots(date), ts);
}

async function getSlots(env: Env, date: string) {
  return kvGetJSON<string[]>(env.LINE_BOOKING, kSlots(date), []);
}
async function getResv(env: Env, date: string) {
  return kvGetJSON<Record<string, string>>(env.LINE_BOOKING, kResv(date), {});
}
async function putResv(env: Env, date: string, map: Record<string, string>) {
  await kvPutJSON(env.LINE_BOOKING, kResv(date), map);
}

// ---- command handlers --------------------------------------------------

async function handleMessage(env: Env, e: LineEvent) {
  if (!e.message?.text) return;
  const text = e.message.text.trim();

  // /set-slots YYYY-MM-DD 10:00,11:30,14:00
  if (text.startsWith("/set-slots")) {
    const m = text.match(/^\/set-slots\s+(\d{4}-\d{2}-\d{2})\s+(.+)$/);
    if (!m) {
      await sendText(env, e, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00");
      return;
    }
    const date = normDate(m[1]);
    const times = m[2].split(",").map(s => s.trim());
    await setSlots(env, date, times);
    await sendText(env, e, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`);
    return;
  }

  // /slots YYYY-MM-DD
  if (text.startsWith("/slots")) {
    const m = text.match(/^\/slots\s+(\d{4}-\d{2}-\d{2})$/);
    if (!m) {
      await sendText(env, e, "使い方: /slots 2025-09-25");
      return;
    }
    const date = normDate(m[1]);
    const slots = await getSlots(env, date);
    const resv  = await getResv(env, date);

    if (!slots.length) {
      await sendText(env, e, `⚠️ ${date} はまだ枠が設定されていないよ。\n/set-slots で登録してね。`);
      return;
    }
    const avail = slots.filter(t => !resv[t]);
    const reserved = slots.filter(t => !!resv[t]);

    const lines = [
      `📅 ${date} の空き状況`,
      `空き: ${avail.length ? avail.join(", ") : "なし"}`,
      `予約済: ${reserved.length ? reserved.join(", ") : "なし"}`,
    ];
    await sendText(env, e, lines.join("\n"));
    return;
  }

  // /reserve YYYY-MM-DD HH:mm タイトル
  if (text.startsWith("/reserve")) {
    const m = text.match(/^\/reserve\s+(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+(.+)$/);
    if (!m) {
      await sendText(env, e, "使い方: /reserve 2025-09-25 10:00 カット");
      return;
    }
    const date = normDate(m[1]);
    const time = normTime(m[2]);
    const title = m[3].trim();

    const slots = await getSlots(env, date);
    if (!slots.includes(time)) {
      await sendText(env, e, `⚠️ その時間は候補にないよ。\n候補: ${slots.join(", ") || "未設定"}`);
      return;
    }
    const resv = await getResv(env, date);
    if (resv[time]) {
      await sendText(env, e, `⚠️ その日時は既に予約があります。\nID: ${resv[time]}`);
      return;
    }
    resv[time] = title || "予約";
    await putResv(env, date, resv);
    await sendText(env, e, `✅ 予約を登録したよ。\n日時: ${date} ${time}\n内容: ${title}`);
    return;
  }

  // その他
  if (text === "/help") {
    await sendText(env, e,
      [
        "使い方:",
        "/set-slots YYYY-MM-DD 10:00,11:30,14:00",
        "/slots YYYY-MM-DD",
        "/reserve YYYY-MM-DD HH:mm タイトル",
      ].join("\n")
    );
  }
}

// ---- worker ------------------------------------------------------------

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // health / debug
    if (req.method === "GET" && url.pathname === "/__ping") return ok("ok");
    if (req.method === "GET" && url.pathname === "/__debug/slots") {
      const date = url.searchParams.get("date") || "";
      const slots = await getSlots(env, date);
      const resv = await getResv(env, date);
      return ok({ date, slots, avail: slots.filter(t => !resv[t]), reserved: Object.keys(resv) });
    }

    // LINE webhook
    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      let body: any = {};
      try { body = await req.json(); } catch { /* ignore */ }
      const events: LineEvent[] = Array.isArray(body.events) ? body.events : [];

      for (const e of events) {
        try {
          if (e.deliveryContext?.isRedelivery) { log("skip redelivery"); continue; }
          if (e.type === "message" && e.message?.type === "text") {
            await handleMessage(env, e); // 同期で実施 → 返信が確実に間に合う
          }
        } catch (err) {
          log("handle error", err);
        }
      }
      return ok("ok");
    }

    return new Response("not found", { status: 404 });
  },
};
