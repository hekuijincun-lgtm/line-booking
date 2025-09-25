// src/index.ts

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
}

type LineEvent = {
  type: string;
  replyToken?: string;
  timestamp?: number;
  deliveryContext?: { isRedelivery?: boolean };
  source?: { userId?: string; type?: string };
  message?: { type: string; text?: string };
  // 他のevent型は必要に応じて追加
};

const REPLY_ENDPOINT = "https://api.line.me/v2/bot/message/reply";

async function replyText(env: Env, replyToken: string, text: string) {
  const body = JSON.stringify({
    replyToken,
    messages: [{ type: "text", text }],
  });

  const res = await fetch(REPLY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body,
  });

  if (!res.ok) {
    const msg = await res.text();
    throw new Error(`LINE Reply Error: ${res.status} ${msg}`);
  }
}

function parseSlotsArgs(text: string | undefined) {
  // /set-slots 2025-09-25 10:00,11:30,14:00
  if (!text) return null;
  const [cmd, date, timesRaw] = text.trim().split(/\s+/, 3);
  if (!cmd || !date) return null;
  return { cmd, date, timesRaw };
}

async function handleMessage(env: Env, event: LineEvent, ctx: ExecutionContext) {
  const replyToken = event.replyToken!;
  const text = event.message?.text?.trim() || "";

  // 1) /set-slots YYYY-MM-DD hh:mm,hh:mm,...
  if (text.startsWith("/set-slots")) {
    const parsed = parseSlotsArgs(text);
    if (!parsed || !parsed.timesRaw) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00"));
      return;
    }
    const key = `slots:${parsed.date}`;
    // 正規化（空白削除、全角カンマ対策）
    const times = parsed.timesRaw.replace(/、/g, ",").replace(/\s/g, "");
    await env.LINE_BOOKING.put(key, times, { expirationTtl: 60 * 60 * 24 * 30 }); // 30日TTL（お好みで）
    ctx.waitUntil(
      replyText(
        env,
        replyToken,
        `✅ ${parsed.date} の枠を更新したよ。\n${times.split(",").join(", ")}`
      )
    );
    return;
  }

  // 2) /slots YYYY-MM-DD
  if (text.startsWith("/slots")) {
    const [, date] = text.split(/\s+/, 2);
    if (!date) {
      ctx.waitUntil(replyText(env, replyToken, "使い方: /slots 2025-09-25"));
      return;
    }
    const key = `slots:${date}`;
    const times = await env.LINE_BOOKING.get(key);
    if (times) {
      ctx.waitUntil(replyText(env, replyToken, `${date} の枠:\n${times.split(",").join(", ")}`));
    } else {
      ctx.waitUntil(replyText(env, replyToken, `${date} の枠はまだ登録されてないよ`));
    }
    return;
  }

  // 3) その他はエコー
  ctx.waitUntil(replyText(env, replyToken, `echo: ${text}`));
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/__ping") {
      return new Response("ok", { status: 200 });
    }

    if (request.method === "POST" && url.pathname === "/api/line/webhook") {
      // Webhook本体
      let payload: any;
      try {
        payload = await request.json();
      } catch {
        // すぐ200返す（LINEの再送を防ぐ）
        return new Response("bad json", { status: 200 });
      }

      const events: LineEvent[] = payload.events || [];

      // 先に200を返して再送を防止（めっちゃ大事）
      const earlyOk = new Response("ok", { status: 200 });

      // 後処理
      ctx.waitUntil(
        (async () => {
          for (const e of events) {
            try {
              // 再配信（redelivery）は無視して二重返信を防ぐ
              if (e.deliveryContext?.isRedelivery) continue;

              // messageイベントのみ扱う
              if (e.type === "message" && e.message?.type === "text" && e.replyToken) {
                await handleMessage(env, e, ctx);
              }
            } catch (err) {
              // ここでthrowするとwrangler tailに出る。replyToken期限切れ等の調査用
              console.error(err);
            }
          }
        })()
      );

      return earlyOk;
    }

    return new Response("Not Found", { status: 404 });
  },
};
