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

// ---------- utils ----------
function log(...args: any[]) {
  // wrangler tail で追いやすいprefix
  console.log("[line-booking]", ...args);
}

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
const keyResId = (id: string) => `RESID:${id}`;

function normSpaces(s: string) {
  return s.replace(/\u3000/g, " ").replace(/\s+/g, " ").trim();
}

function parseCmd(text?: string) {
  if (!text) return { cmd: "", args: [] as string[], raw: "" };
  const raw = text;
  const t = normSpaces(text.replace(/[，、]/g, ",")); // 全角カンマ吸収
  const [cmd, ...args] = t.split(" ");
  return { cmd, args, raw };
}

function z2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function normalizeDateArg(arg: string): string | null {
  // 受け入れ: YYYY-MM-DD / YYYY/M/D / M/D
  const now = new Date();
  const y = now.getFullYear();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(arg)) return arg;

  // YYYY/M/D or YYYY-M-D
  let m = arg.match(/^(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})$/);
  if (m) return `${m[1]}-${z2(+m[2])}-${z2(+m[3])}`;

  // M/D
  m = arg.match(/^(\d{1,2})[\/-](\d{1,2})$/);
  if (m) return `${y}-${z2(+m[1])}-${z2(+m[2])}`;

  return null;
}

function parseTimes(csv: string) {
  return csv.replace(/、/g, ",").replace(/\s/g, "").split(",").filter(Boolean);
}

async function listAvailable(env: Env, date: string) {
  const base = (await env.LINE_BOOKING.get(keySlots(date))) || "";
  const slots = parseTimes(base);
  if (slots.length === 0) return { slots: [] as string[], avail: [] as string[], reserved: [] as string[] };

  const checks = await Promise.all(
    slots.map(async (t) => ({ t, v: await env.LINE_BOOKING.get(keyRes(date, t)) }))
  );
  const reserved = checks.filter((x) => x.v).map((x) => x.t);
  const avail = slots.filter((t) => !reserved.includes(t));
  return { slots, avail, reserved };
}

function genId() {
  return crypto.randomUUID().slice(0, 8);
}

// ---------- handlers ----------
async function handleMessage(env: Env, e: LineEvent, ctx: ExecutionContext) {
  const replyToken = e.replyToken!;
  const text = e.message?.text ?? "";
  const { cmd, args, raw } = parseCmd(text);

  log("cmd:", cmd, "args:", args.join("|"), "raw:", raw);

  if (cmd === "/help") {
    ctx.waitUntil(
      replyText(
        env,
        replyToken,
        [
          "使い方：",
          "・/set-slots YYYY-MM-DD 10:00,11:30,14:00",
          "・/slots YYYY-MM-DD  または  /slots 9/25",
          "・/reserve YYYY-MM-DD HH:MM <内容>",
        ].join("\n")
      )
    );
    return;
  }

  if (cmd === "/set-slots") {
    const [dateArg, ...rest] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    const csv = rest.join(" ");
    if (!date || !csv) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00"));
      return;
    }
    const times = parseTimes(csv);
    await env.LINE_BOOKING.put(keySlots(date), times.join(","), { expirationTtl: 60 * 60 * 24 * 60 });
    log("set-slots", date, times);
    ctx.waitUntil(replyText(env, replyToken, `✅ ${date} の枠を更新したよ。\n${times.join(", ")}`));
    return;
  }

  if (cmd === "/slots") {
    const [dateArg] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    if (!date) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /slots 2025-09-25（9/25でもOK）"));
      return;
    }
    const { slots, avail, reserved } = await listAvailable(env, date);
    log("slots", date, { slots, avail, reserved });
    if (slots.length === 0) {
      ctx.waitUntil(replyText(env, replyToken, `${date} の枠はまだ登録されてないよ`));
      return;
    }
    const head = `📅 ${date} の枠`;
    const a = avail.length > 0 ? `空き: ${avail.join(", ")}` : "空き: なし🙏";
    const r = reserved.length > 0 ? `予約済: ${reserved.join(", ")}` : "予約済: なし";
    ctx.waitUntil(replyText(env, replyToken, `${head}\n${a}\n${r}`));
    return;
  }

  if (cmd === "/reserve") {
    const [dateArg, time, ...rest] = args;
    const date = dateArg ? normalizeDateArg(dateArg) : null;
    const content = rest.join(" ") || "予約";
    if (!date || !time) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /reserve 2025-09-25 10:00 カット"));
      return;
    }

    const { slots } = await listAvailable(env, date);
    if (slots.length === 0 || !slots.includes(time)) {
      ctx.waitUntil(replyText(env, replyToken, `その日付は枠が未設定か、時刻 ${time} は存在しないよ`));
      return;
    }

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

    const id = genId();
    const rec = { id, date, time, content, at: Date.now() };
    await Promise.all([
      env.LINE_BOOKING.put(keyRes(date, time), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
      env.LINE_BOOKING.put(keyResId(id), JSON.stringify(rec), { expirationTtl: 60 * 60 * 24 * 60 }),
    ]);

    log("reserve", rec);
    ctx.waitUntil(
      replyText(
        env,
        replyToken,
        ["✅ 予約を確定したよ！", `ID: ${id}`, `日時: ${date} ${time}`, `内容: ${content}`].join("\n")
      )
    );
    return;
  }

  // fallback
  ctx.waitUntil(replyText(env, replyToken, `echo: ${text}`));
}

// ---------- worker ----------
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

      // 先に200返して再送防止
      const early = new Response("ok", { status: 200 });

      ctx.waitUntil(
        (async () => {
          for (const e of events) {
            try {
              if (e.deliveryContext?.isRedelivery) {
                log("skip redelivery");
                continue;
              }
              if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
                await handleMessage(env, e, ctx);
              } else {
                log("ignore event", e.type);
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
