export default {
  async fetch(req: Request, env: any): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/__ping") return new Response("ok");
    if (url.pathname === "/api/bookings" && req.method === "GET") {
      return Response.json({ items: [] });
    }
    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      // TODO: verify LINE signature using env.LINE_CHANNEL_SECRET
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }
} as ExportedHandler;
