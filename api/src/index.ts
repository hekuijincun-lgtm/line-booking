// api/src/index.ts

type LineEvent =
  | {
      type: "message";
      replyToken?: string;
      message?: { type: "text"; text: string };
      source?: { userId?: string };
    }
  | Record<string, unknown>;

interface Env {
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  BASE_URL: string;
  LINE_BOOKING: KVNamespace;
}

function toBase64(arr: ArrayBuffer): string {
  const bytes = new Uint8Array(arr);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

async function verifyLineSignature(req: Request, channelSecret: string): Promise<string | null> {
  const raw = await req.clone().text();
  const headerSig = req.headers.get("x-line-signature") || "";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const calc = toBase64(sigBuf);
  if (calc !== headerSig) return null;
  return raw;
}

async function lineReply(env: Env, replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });
  if (!res.ok) {
    console.log("LINE reply error", res.status, await res.text());
  }
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/__ping") return new Response("ok");

    // --- Bookings API ---
    if (url.pathname === "/api/bookings" && req.method === "POST") {
      // 超シンプル保存（まずはKVに突っ込む）
      const b = (await req.json()) as {
        storeId?: string;
        customerId?: string;
        start?: string;
        end?: string;
      };
      const id = crypto.randomUUID();
      const item = {
        id,
        storeId: b.storeId ?? "default",
        customerId: b.customerId ?? "anon",
        start: b.start ?? new Date().toISOString(),
        end: b.end ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
        status: "created",
        createdAt: new Date().toISOString(),
      };
      await env.LINE_BOOKING.put(`booking:${id}`, JSON.stringify(item));
      return Response.json(item, { status: 201 });
    }

    if (url.pathname === "/api/bookings" && req.method === "GET") {
      // ここは後でD1に移行。いまは空配列を返す
      return Response.json({ items: [] });
    }

    // --- LINE Webhook ---
    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      const raw = await verifyLineSignature(req, env.LINE_CHANNEL_SECRET);
      if (!raw) return new Response("bad signature", { status: 401 });

      const body = JSON.parse(raw) as { events?: LineEvent[] };
      const ev = body.events?.[0] as LineEvent | undefined;

      const text = (ev as any)?.message?.text as string | undefined;
      const userId = (ev as any)?.source?.userId ?? "unknown";

      // ログっぽくKVに最後のメッセージを保存（デバッグに便利）
      if (text) await env.LINE_BOOKING.put(`last:${userId}`, text);

      // まずはECHOでOK
      const replyToken = (ev as any)?.replyToken;
      if (replyToken) {
        await lineReply(env, replyToken, `echo: ${text ?? "…"}`);
      }

      // おまけ：超仮の予約作成（「明日10:00」とかのパースは後で）
      // 「予約」って文字が入っていたら固定30分で予約作成
      if (text && text.includes("予約")) {
        const id = crypto.randomUUID();
        const now = new Date();
        const start = new Date(now.getTime() + 60 * 60 * 1000); // 今から1時間後（仮）
        const end = new Date(start.getTime() + 30 * 60 * 1000);
        const item = {
          id,
          storeId: "default",
          customerId: userId,
          start: start.toISOString(),
          end: end.toISOString(),
          via: "line",
          createdAt: new Date().toISOString(),
        };
        await env.LINE_BOOKING.put(`booking:${id}`, JSON.stringify(item));
        if (replyToken) {
          await lineReply(env, replyToken, `予約を受け付けました（ID: ${id}）`);
        }
      }

      return new Response("ok");
    }

    return new Response("not found", { status: 404 });
  },
} as ExportedHandler<Env>;
