export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/__ping") return new Response("ok");

    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      // ここでは署名検証をスキップ（あとで追加）
      const body = await req.json().catch(() => ({}));
      const events = body?.events ?? [];

      await Promise.all(events.map(async (ev: any) => {
        if (ev.type === "message" && ev.message?.type === "text" && ev.replyToken) {
          await fetch("https://api.line.me/v2/bot/message/reply", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
            },
            body: JSON.stringify({
              replyToken: ev.replyToken,
              messages: [{ type: "text", text: `echo: ${ev.message.text}` }],
            }),
          });
        }
      }));

      return new Response("ok");
    }

    if (url.pathname === "/api/bookings" && req.method === "GET") {
      return Response.json({ items: [] });
    }

    return new Response("not found", { status: 404 });
  }
} as ExportedHandler;
