import { tryHandleBookingUiREST } from "./booking-ui-rest";
import { Hono } from "hono";
import { publicApi } from "./routes/public";
import { handleAdminReservations } from "./admin-reservations";
import { handleAdminKvDump } from "./admin-kv-dump";

// ---- Durable Object (stub for wiring) ----
export class SlotLockV4 {
  state: DurableObjectState;
  env: any;
  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    this.env = env;
  }
  async fetch(_req: Request) {
    return new Response("DO alive", {
      status: 200,
      headers: { "content-type": "text/plain" },
    });
  }
}
// backward compatibility (old class_name=SlotLockV3)
export { SlotLockV4 as SlotLockV3 };

const app = new Hono();

app.route("/api/public", publicApi);

/** ==== injected(env) ==== */
const __resolveEnv = (c: any) => {
  const host = c.req?.raw?.headers?.get?.("host") || "";
  const v = c.env?.ENV_NAME ?? c.env?.EnvName ?? c.env?.env_name;
  return v ?? (host.includes("-staging-") ? "staging" : "production");
};

app.get("/__env", (c: any) => {
  const runtimeEnv = __resolveEnv(c);
  const keys = Object.keys(c.env || {}).sort();
  const peek: Record<string, string> = {};
  for (const k of keys) {
    if (typeof (c.env as any)[k] === "string") {
      peek[k] = (c.env as any)[k];
    }
  }
  return c.json({
    ok: true,
    runtimeEnv,
    ENV_NAME: (c.env as any)?.ENV_NAME ?? null,
    keys,
    peek,
  });
});

app.get("/__health", async (c: any) => {
  const envName = __resolveEnv(c);
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // KV チェック
  try {
    const key = `__health:${Date.now()}`;
    await c.env.LINE_BOOKING.put(key, "1", { expirationTtl: 60 });
    const v = await c.env.LINE_BOOKING.get(key);
    checks.kv = { ok: v === "1" };
  } catch (e: any) {
    checks.kv = { ok: false, detail: String(e?.message ?? e) };
  }

  // DO チェック
  try {
    const id = c.env.SLOT_LOCK.idFromName("probe");
    const stub = c.env.SLOT_LOCK.get(id);
    const r = await stub.fetch("https://do/probe");
    checks.do = { ok: r.ok };
  } catch (e: any) {
    checks.do = { ok: false, detail: String(e?.message ?? e) };
  }

  const ok = Object.values(checks).every((x) => x.ok);
  return c.json({ ok, ts: Date.now(), env: envName, checks });
});

// 予約一覧 API
app.get("/admin/reservations", async (c: any) => {
  return handleAdminReservations(c.req.raw as Request, c.env as any);
});

// KV ダンプ API
app.get("/admin/kv-dump", async (c: any) => {
  return handleAdminKvDump(c.req.raw as Request, c.env as any);
});

// __ENV_ROUTES_END__

const __orig = app;

export default {
  async fetch(request: Request, env: any, ctx: any): Promise<Response> {
    // 先に Booking UI REST ( /line/slots /line/reserve など ) をハンドル
    const maybe = await tryHandleBookingUiREST(request as Request, env as any);
    if (maybe) return maybe;

    // 残りは Hono アプリ（/api/public, /__health, /admin/* など）
    return __orig.fetch(request, env, ctx);
  },
};
