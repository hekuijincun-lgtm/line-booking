import { Hono } from "hono";
import { publicApi } from "./routes/public";

// ---- Durable Object (stub for wiring) ----
export class SlotLockV4 {
  state: DurableObjectState; env: any;
  constructor(state: DurableObjectState, env: any) { this.state = state; this.env = env; }
  async fetch(_req: Request) {
    return new Response("DO alive", { status: 200, headers: { "content-type": "text/plain" } });
  }
}
// backward compatibility (old class_name=SlotLockV3)
export { SlotLockV4 as SlotLockV3 };

const app = new Hono();

app.route("/api/public", publicApi);

app.get("/__health", (c) => {
  // @ts-ignore
  const base = (c.env && (c.env as any).BASE_URL) ? (c.env as any).BASE_URL : "default";
  const FEATURES = { monthList: true, flexibleSlots: true, whoami: true } as const;
  return c.json({ ok: true, ts: Date.now(), env: base, features: FEATURES });
});

export default app;


