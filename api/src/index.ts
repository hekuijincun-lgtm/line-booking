// src/index.ts
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

const REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

async function replyText(env: Env, replyToken: string, text: string) {
  const res = await fetch(REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) throw new Error(`LINE Reply Error: ${res.status} ${await res.text()}`);
}

const keySlots = (date: string) => `SLOTS:${date}`;
const keyRes = (date: string, time: string) => `RES:${date}:${time}`;
const keyResId = (id: string) => `RESID:${id}`; // 逆引き用（ID→詳細）

function normSpaces(s: string) {
  return s.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function parseCmd(text?: string) {
  if (!text) return { cmd: "", args: [] as string[] };
  const t = normSpaces(text);
  const [cmd, ...args] = t.split(" ");
  return { cmd, args };
}

function parseTimes(csv: string) {
  return csv.replace(/、/g, ",").replace(/\s/g, "").split(",").filter(Boolean);
}

async function listAvailable(env: Env, date: string) {
  const base = (await env.LINE_BOOKING.get(keySlots(date))) || "";
  const slots = parseTimes(base);
  if (slots.length === 0) return { slots: [], avail: [] as string[] };

  // KVに「予約済みの印」を置く方式（値はJSONでもOK）
  const checks = await Promise.all(
    slots.map(async (t) => ({ t, v: await env.LINE_BOOKING.get(keyRes(date, t)) }))
  );
  const reserved = new Set(checks.filter((x) => x.v).map((x) => x.t));
  const avail = slots.filter((t) => !reserved.has(t));
  return { slots, avail };
}

function genId() {
  return crypto.randomUUID().slice(0, 8); // 表示しやすい短縮ID
}

async function handleMessage(env: Env, e: LineEvent, ctx: ExecutionContext) {
  const replyToken = e.replyToken!;
  const text = e.message?.text ?? "";
  const { cmd, args } = parseCmd(text);

  // /help
  if (cmd === "/help") {
    ctx.waitUntil(
      replyText(
        env,
        replyToken,
        [
          "使い方：",
          "・/set-slots YYYY-MM-DD 10:00,11:30,14:00",
          "・/slots YYYY-MM-DD",
          "・/reserve YYYY-MM-DD HH:MM <内容>",
        ].join("\n")
      )
    );
    return;
  }

  // /set-slots
  if (cmd === "/set-slots") {
    const [date, csv] = [args[0], args.slice(1).join(" ")];
    if (!date || !csv) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00"));
      return;
    }
    const times = parseTimes(csv);
    await env.LINE_BOOKING.put(keySlots(date), times.join(","), { expirationTtl: 60 * 60 * 24 * 60 });
    ctx.waitUntil(replyText(env, replyToken, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`));
    return;
  }

  // /slots
  if (cmd === "/slots") {
    const [date] = args;
    if (!date) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /slots 2025-09-25"));
      return;
    }
    const { slots, avail } = await listAvailable(env, date);
    if (slots.length === 0) {
      ctx.waitUntil(replyText(env, replyToken, `${date} の枠はまだ登録されてないよ`));
      return;
    }
    const head = `📅 ${date} の枠`;
    const body =
      avail.length > 0
        ? `空き: ${avail.join(", ")}`
        : "満席です🙏";
    ctx.waitUntil(replyText(env, replyToken, `${head}\n${body}`));
    return;
  }

  // /reserve
  if (cmd === "/reserve") {
    const [date, time, ...rest] = args;
    const content = rest.join(" ") || "予約";
    if (!date || !time) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /reserve 2025-09-25 10:00 カット"));
      return;
    }

    // 枠の存在チェック
    const { slots } = await listAvailable(env, date);
    if (slots.length === 0 || !slots.includes(time)) {
      ctx.waitUntil(replyText(env, replyToken, `その日付は枠が未設定か、時刻 ${time} は存在しないよ`));
      return;
    }

    // 競合チェック（既に予約済み？）
    const existing = await env.LINE_BOOKING.get(keyRes(date, time));
    if (existing) {
      const j = JSON.parse(existing);
      ctx.waitUntil(
        replyText(
          env,
          replyToken,
          [
            "⚠️ その日時は既に予約があります。",
            `ID: ${j.id}`,
            `日時: ${date} ${time}`,
            `内容: ${j.content}`,
            "",
            "別の時間で予約してね🙏",
          ].join("\n")
        )
      );
      return;
    }

    // 予約作成
    const id = genId();
    const rec = { id, date, time, content, at: Date.now() };
    await Promise.all([
      env.LINE_BOOKING.put(keyRes(date, time), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
      env.LINE_BOOKING.put(keyResId(id), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
    ]);

    ctx.waitUntil(
      replyText(
        env,
        replyToken,
        [
          "✅ 予約を確定したよ！",
          `ID: ${id}`,
          `日時: ${date} ${time}`,
          `内容: ${content}`,
        ].join("\n")
      )
    );
    return;
  }

  // fallback: echo
  ctx.waitUntil(replyText(env, replyToken, `echo: ${text}`));
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    if (req.method === "GET" && url.pathname === "/__ping") {
      return new Response("ok", { status: 200 });
    }

    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      let body: any;
      try {
        body = await req.json();
      } catch {
        return new Response("ok", { status: 200 });
      }
      const events: LineEvent[] = body.events ?? [];

      // 先にOK返し（再送防止）
      const early = new Response("ok", { status: 200 });

      ctx.waitUntil(
        (async () => {
          for (const e of events) {
            try {
              if (e.deliveryContext?.isRedelivery) continue;
              if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
                await handleMessage(env, e, ctx);
              }
            } catch (err) {
              console.error(err);
            }
          }
        })()
      );

      return early;
    }

    return new Response("Not Found", { status: 404 });
  },
};
