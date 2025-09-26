// Cloudflare Worker (LINE 予約ボット)
// - /set-slots YYYY-MM-DD 10:00,11:30,...
// - /slots YYYY-MM-DD   （9/25 など柔軟対応）
// - /reserve YYYY-MM-DD HH:MM 内容
// 返信は reply → 失敗時 push に自動フォールバック

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

type LineEvent = {
  type: string;
  replyToken?: string;
  deliveryContext?: { isRedelivery?: boolean };
  message?: { type: "text"; text?: string };
  source?: { userId?: string };
};

const LINE_REPLY = "https://api.line.me/v2/bot/message/reply";
const LINE_PUSH  = "https://api.line.me/v2/bot/message/push";

// ---------- utils ----------
function log(...a: any[]) { console.log("[line-booking]", ...a); }

function normSpaces(s: string) {
  return s.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function parseCmd(text?: string) {
  if (!text) return { cmd: "", args: [] as string[], raw: "" };
  const raw = text;
  const t = normSpaces(text.replace(/[，、]/g, ",")); // 全角カンマ許容
  const [cmd, ...args] = t.split(" ");
  return { cmd, args, raw };
}

function z2(n: number) { return n < 10 ? `0${n}` : `${n}`; }

function normalizeDateArg(arg: string): string | null {
  const y = new Date().getFullYear();
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;
  let m = arg.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) return `${m[1]}-${z2(+m[2])}-${z2(+m[3])}`;
  m = arg.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (m) return `${y}-${z2(+m[1])}-${z2(+m[2])}`;
  return null;
}

function parseTimes(csv: string) {
  return csv.replace(/、/g, ",").replace(/\s/g, "").split(",").filter(Boolean);
}

const keySlots = (d: string) => `SLOTS:${d}`;
const keyRes   = (d: string, t: string) => `RES:${d}:${t}`;
const keyResId = (id: string) => `RESID:${id}`;

async function listAvailable(env: Env, date: string) {
  const base = (await env.LINE_BOOKING.get(keySlots(date))) || "";
  const slots = parseTimes(base);
  if (slots.length === 0) return { slots, avail: [] as string[], reserved: [] as string[] };
  const checks = await Promise.all(
    slots.map(async (t) => ({ t, v: await env.LINE_BOOKING.get(keyRes(date, t)) }))
  );
  const reserved = checks.filter((x) => x.v).map((x) => x.t);
  const avail = slots.filter((t) => !reserved.includes(t));
  return { slots, avail, reserved };
}

function genId() { return crypto.randomUUID().slice(0, 8); }

async function sendText(env: Env, e: LineEvent, text: string) {
  // 1) reply
  if (e.replyToken) {
    const r = await fetch(LINE_REPLY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      },
      body: JSON.stringify({ replyToken: e.replyToken, messages: [{ type: "text", text }] }),
    });
    if (r.ok) return;
    const msg = await r.text();
    log("reply failed", r.status, msg);
    // 2) push fallback（replyToken失効など）
    if (r.status === 400 && /Invalid reply token/i.test(msg) && e.source?.userId) {
      const p = await fetch(LINE_PUSH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({ to: e.source.userId, messages: [{ type: "text", text }] }),
      });
      if (!p.ok) log("push failed", p.status, await p.text());
    }
    return;
  }
}

// ---------- handlers ----------
async function handleMessage(env: Env, e: LineEvent, ctx: ExecutionContext) {
  const text = e.message?.text ?? "";
  const { cmd, args, raw } = parseCmd(text);
  log("recv", { cmd, args, raw });

  if (cmd === "/help") {
    ctx.waitUntil(sendText(env, e,
      "使い方：\n・/set-slots YYYY-MM-DD 10:00,11:30,14:00\n・/slots YYYY-MM-DD（9/25でもOK）\n・/reserve YYYY-MM-DD HH:MM 内容"
    ));
    return;
  }

  if (cmd === "/set-slots") {
    const [dateArg, ...rest] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    const csv  = rest.join(" ");
    if (!date || !csv) {
      ctx.waitUntil(sendText(env, e, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00"));
      return;
    }
    const times = parseTimes(csv);
    await env.LINE_BOOKING.put(keySlots(date), times.join(","), { expirationTtl: 60 * 60 * 24 * 60 });
    log("set-slots", date, times);
    ctx.waitUntil(sendText(env, e, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`));
    return;
  }

  if (cmd === "/slots") {
    const [dateArg] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    if (!date) {
      ctx.waitUntil(sendText(env, e, "使い方: /slots 2025-09-25（9/25でもOK）"));
      return;
    }
    const data = await listAvailable(env, date);
    log("slots", date, data);
    if (data.slots.length === 0) {
      ctx.waitUntil(sendText(env, e, `${date} の枠はまだ登録されてないよ`));
      return;
    }
    const msg =
      `📅 ${date} の枠\n` +
      `空き: ${data.avail.length ? data.avail.join(", ") : "なし🙏"}\n` +
      `予約済: ${data.reserved.length ? data.reserved.join(", ") : "なし"}`;
    ctx.waitUntil(sendText(env, e, msg));
    return;
  }

  if (cmd === "/reserve") {
    const [dateArg, time, ...rest] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    const content = rest.join(" ") || "予約";
    if (!date || !time) {
      ctx.waitUntil(sendText(env, e, "使い方: /reserve 2025-09-25 10:00 カット"));
      return;
    }

    const { slots } = await listAvailable(env, date);
    if (slots.length === 0 || !slots.includes(time)) {
      ctx.waitUntil(sendText(env, e, `その日付は枠未設定か、時刻 ${time} は存在しないよ`));
      return;
    }

    const exist = await env.LINE_BOOKING.get(keyRes(date, time));
    if (exist) {
      const j = JSON.parse(exist);
      ctx.waitUntil(sendText(
        env, e,
        `⚠️ その日時は既に予約があります。\nID: ${j.id}\n日時: ${date} ${time}\n内容: ${j.content}\n\n別の時間で予約してね🙏`
      ));
      return;
    }

    const id = genId();
    const rec = { id, date, time, content, at: Date.now() };
    await Promise.all([
      env.LINE_BOOKING.put(keyRes(date, time), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
      env.LINE_BOOKING.put(keyResId(id), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
    ]);
    log("reserve", rec);
    ctx.waitUntil(sendText(env, e, `✅ 予約を確定したよ！\nID: ${id}\n日時: ${date} ${time}\n内容: ${content}`));
    return;
  }

  // fallback
  ctx.waitUntil(sendText(env, e, `echo: ${text}`));
}

// ---------- worker ----------
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // ヘルスチェック
    if (req.method === "GET" && url.pathname === "/__ping") {
      return new Response("ok", { status: 200 });
    }

    // デバッグ（ブラウザで状態確認）
    if (req.method === "GET" && url.pathname === "/__debug/slots") {
      const date = url.searchParams.get("date") || "";
      const data = date ? await listAvailable(env, date) : { slots: [], avail: [], reserved: [] };
      return new Response(JSON.stringify({ date, ...data }, null, 2), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      let body: any;
      try { body = await req.json(); } catch { return new Response("ok", { status: 200 }); }
      const events: LineEvent[] = body.events ?? [];

      // 先に200を返して再送防止
      const early = new Response("ok", { status: 200 });

      ctx.waitUntil((async () => {
        for (const e of events) {
          try {
            if (e.deliveryContext?.isRedelivery) { log("skip redelivery"); continue; }
            if (e.type === "message" && e.message?.type === "text") {
              await handleMessage(env, e, ctx);
            } else {
              log("ignore event", e.type);
            }
          } catch (err) {
            console.error(err);
          }
        }
      })());

      return early;
    }

    return new Response("Not Found", { status: 404 });
  },
};
