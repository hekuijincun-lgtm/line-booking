import { tryHandleBookingUiREST } from "./booking-ui-rest";
import { Hono } from "hono";
import { publicApi } from "./routes/public";

// ==== 予約一覧用の型 ==================================
type Reservation = {
  id: string;
  slotId: string;
  date: string;      // YYYY-MM-DD
  start: string;     // ISO string or "HH:mm"
  end: string;       // ISO string or "HH:mm"
  name: string;
  channel?: string;
  note?: string;
  createdAt: string; // ISO string
};

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


/** ==== injected(env) ==== */
const __resolveEnv = (c: any) => {
  const host = c.req?.raw?.headers?.get?.("host") || "";
  const v = (c.env?.ENV_NAME ?? c.env?.EnvName ?? c.env?.env_name);
  return v ?? (host.includes("-staging-") ? "staging" : "production");
};

app.get("/__env", (c: any) => {
  const runtimeEnv = __resolveEnv(c);
  const keys = Object.keys(c.env || {}).sort();
  const peek: Record<string,string> = {};
  for (const k of keys) if (typeof (c.env as any)[k] === "string") peek[k] = (c.env as any)[k];
  return c.json({ ok: true, runtimeEnv, ENV_NAME: (c.env as any)?.ENV_NAME ?? null, keys, peek });
});

// ` (auto-sanitized)
/** ==== /injected ==== */
// __ENV_ROUTES_START__
app.get("/__env", (c: any) => {
  const runtimeEnv = __resolveEnv(c);
  const keys = Object.keys(c.env || {}).sort();
  const peek: Record<string,string> = {};
  for (const k of keys) if (typeof (c.env as any)[k] === "string") peek[k] = (c.env as any)[k];
  return c.json({ ok: true, runtimeEnv, ENV_NAME: (c.env as any)?.ENV_NAME ?? null, keys, peek });
});

app.get("/__health", async (c: any) => {
  const env = __resolveEnv(c);
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  try {
    const key = `__health:${Date.now()}`;
    await c.env.LINE_BOOKING.put(key, "1", { expirationTtl: 60 });
    const v = await c.env.LINE_BOOKING.get(key);
    checks.kv = { ok: v === "1" };
  } catch (e:any) {
    checks.kv = { ok: false, detail: String(e?.message ?? e) };
  }

  try {
    const id = c.env.SLOT_LOCK.idFromName("probe");
    const stub = c.env.SLOT_LOCK.get(id);
    const r = await stub.fetch("https://do/probe");
    checks.do = { ok: r.ok };
  } catch (e:any) {
    checks.do = { ok: false, detail: String(e?.message ?? e) };
  }

  const ok = Object.values(checks).every(x => x.ok);
  return c.json({ ok, ts: Date.now(), env, checks });
});
// __ENV_ROUTES_END__


// ======================================================
// 🔐 管理者向け 予約一覧 API (/admin/reservations)
// ======================================================
//
// - GET /admin/reservations?date=YYYY-MM-DD
// - GET /admin/reservations?from=YYYY-MM-DD&to=YYYY-MM-DD
//
// 環境変数 BOOKING_ADMIN_TOKEN が設定されている場合は Bearer 認証を要求。
// 設定されていない場合は認証なし（ローカル/テスト用）。
//
// 予約データは KV (env.LINE_BOOKING) から取得。
// prefix "resv:" は実際の保存形式に合わせて変更してOK。
// ======================================================

app.get("/admin/reservations", async (c: any) => {
  const url = new URL(c.req.raw.url);

  // --- optional: Bearer 認証（BOOKING_ADMIN_TOKEN があるときだけ有効） ---
  const adminToken = (c.env as any).BOOKING_ADMIN_TOKEN as string | undefined;
  if (adminToken) {
    const auth = c.req.raw.headers.get("authorization") || "";
    const token = auth.startsWith("Bearer ")
      ? auth.substring("Bearer ".length)
      : "";
    if (token !== adminToken) {
      return c.text("Unauthorized", 401);
    }
  }

  const date = url.searchParams.get("date") ?? undefined;
  const from = url.searchParams.get("from") ?? undefined;
  const to   = url.searchParams.get("to")   ?? undefined;

  const kv = (c.env as any).LINE_BOOKING as KVNamespace;

  // 👇 prefix は実際の予約保存キーに合わせて変更してOK
  const list = await kv.list({ prefix: "resv:" });

  const reservations: Reservation[] = [];

  for (const key of list.keys) {
    const value: any = await kv.get(key.name, "json");
    if (!value) continue;

    const r: Reservation = {
      id: value.id ?? key.name,
      slotId: value.slotId,
      date: value.date,
      start: value.start,
      end: value.end,
      name: value.name,
      channel: value.channel,
      note: value.note,
      createdAt: value.createdAt ?? new Date().toISOString(),
    };

    // 日付フィルタ
    if (date && r.date !== date) continue;
    if (from && r.date < from)   continue;
    if (to && r.date > to)       continue;

    reservations.push(r);
  }

  // 日付＋時間でソート（テンプレじゃなく普通の文字列連結）
  reservations.sort((a, b) => {
    const ak = a.date + "T" + a.start;
    const bk = b.date + "T" + b.start;
    return ak.localeCompare(bk);
  });

  return c.json({ reservations });
});









const __orig = app;
export default {
  async fetch(request: Request, env: any, ctx: any) {
    const maybe = await tryHandleBookingUiREST(request as Request, env as any);
    if (maybe) return maybe;
    return __orig.fetch(request, env, ctx);
  }
};
