// SaaS booking Worker
// - LINE 署名検証
// - 予約スロット管理（KV）
// - Durable Object で二重予約防止
// - 管理者コマンド（/set-slots /list /copy-slots /report）
// - /whoami /ping など
// - 診断ルート: /__health, /__diag/push

export interface Env {
  LINE_BOOKING: KVNamespace;
  SLOT_LOCK: DurableObjectNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string; // secret
  LINE_CHANNEL_SECRET: string;       // secret
  ADMINS?: string;
  BASE_URL?: string;
  SLACK_WEBHOOK_URL?: string;        // optional
}

const TZ = "Asia/Tokyo";

// ===== Helpers =====
const nowJST = () => new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
const isPast = (date: string, time: string) =>
  new Date(`${date}T${time}:00+09:00`).getTime() < nowJST().getTime();
const isYmd = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isYm  = (s: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(s);

// ★ 古いイベントを捨てるしきい値（ミリ秒）
const STALE_EVENT_MS = 60_000; // 60秒より古い LINE イベントは無視
function isStaleEvent(ev: any, now = Date.now(), maxAgeMs = STALE_EVENT_MS) {
  const ts = Number(ev?.timestamp ?? 0);
  return !ts || (now - ts > maxAgeMs);
}

const K_SLOTS = (date: string) => `S:${date}`;
const K_RES   = (date: string, time: string) => `R:${date} ${time}`;
const K_USER  = (uid: string, date: string, time: string) => `U:${uid}:${date} ${time}`;

// ---- Admin utils ----
function parseAdmins(raw?: string): Set<string> {
  if (!raw) return new Set();
  return new Set(raw.split(/[,、\s]+/).map(s => s.trim()).filter(Boolean));
}
function isAdmin(uid: string | undefined, admins: Set<string>) {
  return !!uid && admins.has(uid);
}

// ---- LINE signature verification ----
function toBase64(ab: ArrayBuffer): string {
  let s = ""; const v = new Uint8Array(ab);
  for (let i = 0; i < v.length; i++) s += String.fromCharCode(v[i]);
  return btoa(s);
}
function b64url(s: string): string {
  return s.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
async function verifyLineSignature(req: Request, env: Env, raw: string): Promise<boolean> {
  const sig = req.headers.get("x-line-signature") || "";
  if (!sig || !env.LINE_CHANNEL_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  const expected = toBase64(mac);
  const expectedUrl = b64url(expected);
  return sig === expected || sig === expectedUrl;
}

// ---- RateLimit (per uid) ----
async function rateLimit(env: Env, uid: string, limit = 10, windowSec = 60) {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = Math.floor(now / windowSec) * windowSec;
  const ttl = windowStart + windowSec - now;
  const bucket = `RL:${uid}:${Math.floor(now / windowSec)}`;
  const current = parseInt((await env.LINE_BOOKING.get(bucket)) || "0", 10) + 1;
  await env.LINE_BOOKING.put(bucket, String(current), { expirationTtl: Math.max(ttl, 1) });
  return current <= limit;
}

const quickActions = () => ({
  items: [
    { type: "action", action: { type: "message", label: "Show slots",   text: "/slots today" } },
    { type: "action", action: { type: "message", label: "Reserve",       text: "/reserve 2025-10-05 16:30 cut" } },
    { type: "action", action: { type: "message", label: "My bookings",   text: "/my" } },
    { type: "action", action: { type: "message", label: "Cancel",        text: "/cancel 2025-10-05 16:30" } },
    { type: "action", action: { type: "message", label: "Who am I",      text: "/whoami" } },
  ],
});

// ---- Reply（※同期化して確実に送る） ----
async function lineReply(env: Env, replyToken: string, text: string): Promise<boolean> {
  try {
    console.log("LINE_REPLY_ATTEMPT", text.slice(0, 60));
    const res = await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        replyToken,
        messages: [{ type: "text", text, quickReply: quickActions() }],
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.log("LINE_REPLY_FAIL", res.status, body);
      return false;
    }
    console.log("LINE_REPLY_OK");
    return true;
  } catch (e) {
    console.log("LINE_REPLY_FAIL_FETCH", String(e));
    return false;
  }
}

const fmtSlots = (date: string, opens: string[]) =>
  [`[${date}] open slots`, `open: ${opens.length ? opens.join(", ") : "none"}`].join("\n");

// --- Slack notify (optional) ---
async function notifySlack(env: Env, title: string, payload: any) {
  const url = env.SLACK_WEBHOOK_URL || "";
  if (!url) return;
  const body = { text: `*[${title}]*\n\`\`\`${JSON.stringify(payload, null, 2)}\`\`\`` };
  await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .catch(() => {});
}

// ===== Input normalization =====
function parseTimesFlexible(tokens: string[]): string[] {
  const joined = tokens.join(" ").replace(/\s+/g, " ");
  const parts = joined.split(/[ ,]+/).map(s => s.trim()).filter(Boolean);
  const norm = (t: string) => {
    const m = t.match(/^(\d{1,2})(?::)?(\d{2})?$/);
    if (!m) return null;
    const h = Math.min(23, Math.max(0, parseInt(m[1], 10)));
    const mi = m[2] ? Math.min(59, Math.max(0, parseInt(m[2], 10))) : 0;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  };
  return Array.from(new Set(parts.map(norm).filter(Boolean) as string[])).sort();
}

type Parsed = { date: string; time: string; service: string };

function normalizeDateArg(s: string): string | null {
  const z = s.normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
  if (z === "today") {
    const d = nowJST();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  const m = z.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  return isYmd(z) ? z : null;
}

function normalizeMonthArg(s: string): string | null {
  const z = s.normalize("NFKC").trim().replace(/[/.]/g, "-");
  const m = z.match(/^(\d{4})-(\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}`;
  return isYm(z) ? z : null;
}

function parseReserve(text: string, defaultService = "cut"): Parsed | null {
  const z = text.normalize("NFKC").replace(/\s+/g, " ").trim();
  const m = z.match(/(?:^\/?reserve\s+)?(\d{4})[-/](\d{1,2})[-/](\d{1,2})\s+(\d{1,2}):(\d{2})(?:\s+(.+))?$/i);
  if (!m) return null;
  const date = `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  const time = `${m[4].padStart(2, "0")}:${m[5].padStart(2, "0")}`;
  const service = (m[6]?.trim()) || defaultService;
  return { date, time, service };
}

// ===== Durable Object =====
export class SlotLock {
  constructor(private state: DurableObjectState) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/acquire") {
      const ttl = parseInt(url.searchParams.get("ttl") || "15", 10);
      if (await this.state.storage.get("lock")) return new Response("locked", { status: 423 });
      await this.state.storage.put("lock", "1", { expirationTtl: ttl });
      return new Response("ok");
    }
    if (url.pathname === "/release") {
      await this.state.storage.delete("lock");
      return new Response("ok");
    }
    return new Response("not found", { status: 404 });
  }
}
async function acquire(env: Env, key: string, ttlSec = 15) {
  const id = env.SLOT_LOCK.idFromName(key);
  const r = await env.SLOT_LOCK.get(id).fetch("https://lock/acquire?ttl=" + ttlSec, { method: "POST" });
  if (r.status === 423) throw new Error("LOCKED");
}
async function release(env: Env, key: string) {
  const id = env.SLOT_LOCK.idFromName(key);
  await env.SLOT_LOCK.get(id).fetch("https://lock/release", { method: "POST" }).catch(() => {});
}

// ===== Handlers =====
async function handleSetSlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 2) return await lineReply(env, replyToken, "Usage: /set-slots YYYY-MM-DD 10:00,11:00,16:30");
  const date = normalizeDateArg(args[0]);
  if (!date) return await lineReply(env, replyToken, "Bad date format (ex: 2025-10-05)");
  const times = parseTimesFlexible(args.slice(1));
  if (!times.length) return await lineReply(env, replyToken, "No time specified (ex: 10:00 10:30 11:00)");
  await env.LINE_BOOKING.put(K_SLOTS(date), JSON.stringify(times));
  return await lineReply(env, replyToken, `OK: slots updated for ${date}\n${times.join(", ")}`);
}

async function handleSlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return await lineReply(env, replyToken, "Usage: /slots YYYY-MM-DD (ex: /slots today)");
  const date = normalizeDateArg(args[0]);
  if (!date) return await lineReply(env, replyToken, "Bad date format (ex: 2025-10-05)");
  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.length) return await lineReply(env, replyToken, `[WARN] no slots defined for ${date}. Use /set-slots first.`);
  const reserved = await env.LINE_BOOKING.list({ prefix: `R:${date} ` });
  const taken = new Set(reserved.keys.map(k => k.name.substring(`R:${date} `.length)));
  const opens = slots.filter(t => !taken.has(t));
  return await lineReply(env, replyToken, fmtSlots(date, opens));
}

async function handleReserve(env: Env, z: string, replyToken: string, userId: string, userName?: string) {
  const p = parseReserve(z, "cut");
  if (!p) return await lineReply(env, replyToken, "ex) /reserve 2025-10-05 16:30 cut");
  const { date, time, service } = p;
  if (isPast(date, time)) return await lineReply(env, replyToken, "Cannot reserve past time.");
  const slotStr = await env.LINE_BOOKING.get(K_SLOTS(date));
  const slots: string[] = slotStr ? JSON.parse(slotStr) : [];
  if (!slots.includes(time)) return await lineReply(env, replyToken, `Time not in slots. Check with /slots ${date}`);
  const key = `${date} ${time}`;
  try {
    await acquire(env, key, 15);
    if (await env.LINE_BOOKING.get(K_RES(date, time))) {
      return await lineReply(env, replyToken, "Sorry, just taken. Try another time.");
    }
    const rec = { userId, userName, service, date, time, ts: Date.now() };
    await env.LINE_BOOKING.put(K_RES(date, time), JSON.stringify(rec));
    await env.LINE_BOOKING.put(K_USER(userId, date, time), "1");
    return await lineReply(env, replyToken, `OK: reserved.\nwhen: ${date} ${time}\nservice: ${service}`);
  } catch (e: any) {
    if (e?.message === "LOCKED") return await lineReply(env, replyToken, "High contention. Please retry shortly.");
    await notifySlack(env, "RESERVE_FAIL", { date, time, userId, err: e?.message || String(e) });
    throw e;
  } finally {
    await release(env, key);
  }
}

async function handleMy(env: Env, args: string[], replyToken: string, userId: string) {
  const q = args[0]?.trim();
  if (!q) {
    const list = await env.LINE_BOOKING.list({ prefix: `U:${userId}:`, limit: 1000 });
    const now = nowJST().getTime();
    const items: { date: string; time: string }[] = [];
    for (const k of list.keys) {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      if (!m) continue;
      const when = new Date(`${m[1]}T${m[2]}:00+09:00`).getTime();
      if (when >= now) items.push({ date: m[1], time: m[2] });
    }
    items.sort((a, b) => (`${a.date} ${a.time}`).localeCompare(`${b.date} ${b.time}`));
    return await lineReply(env, replyToken, items.length ? `Your bookings\n${items.map(i => `- ${i.date} ${i.time}`).join("\n")}` : "No upcoming bookings.");
  }
  if (isYmd(q)) {
    const prefix = `U:${userId}:${q} `;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 100 });
    const lines = list.keys.map(k => `- ${q} ${k.name.substring(prefix.length)}`);
    return await lineReply(env, replyToken, lines.length ? `Your bookings\n${lines.join("\n")}` : "No bookings for that day.");
  }
  if (isYm(q)) {
    const prefix = `U:${userId}:${q}-`;
    const list = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
    const lines = list.keys.map(k => {
      const m = k.name.match(/^U:[^:]+:(\d{4}-\d{2}-\d{2})\s(.+)$/);
      return m ? `- ${m[1]} ${m[2]}` : "";
    }).filter(Boolean);
    return await lineReply(env, replyToken, lines.length ? `Your bookings (${q})\n${lines.join("\n")}` : "No bookings for that month.");
  }
  return await lineReply(env, replyToken, "Usage: /my | /my YYYY-MM-DD | /my YYYY-MM");
}

async function handleCancel(env: Env, args: string[], replyToken: string, userId: string) {
  if (args.length < 2) return await lineReply(env, replyToken, "Usage: /cancel YYYY-MM-DD HH:MM");
  const date = normalizeDateArg(args[0]);
  if (!date) return await lineReply(env, replyToken, "Bad date format (ex: 2025-10-05)");
  const time = args[1].normalize("NFKC");
  const recStr = await env.LINE_BOOKING.get(K_RES(date, time));
  if (!recStr) return await lineReply(env, replyToken, "Reservation not found.");
  const rec = JSON.parse(recStr);
  if (rec.userId !== userId) return await lineReply(env, replyToken, "This reservation is not yours.");
  await env.LINE_BOOKING.delete(K_RES(date, time));
  await env.LINE_BOOKING.delete(K_USER(userId, date, time));
  return await lineReply(env, replyToken, `OK: canceled.\nwhen: ${date} ${time}`);
}

// ===== Month list/report =====
function daysInMonth(y: number, m: number): number { return new Date(y, m, 0).getDate(); }
function dayOfWeekLabel(y: number, m: number, d: number): string {
  return ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][new Date(y, m - 1, d).getDay()];
}
async function listMonth(env: Env, ym: string, replyToken: string) {
  const [yy, mm] = ym.split("-").map(Number);
  if (!yy || !mm || mm < 1 || mm > 12) return await lineReply(env, replyToken, "Usage: /list YYYY-MM (ex: /list 2025-10)");
  const last = daysInMonth(yy, mm);
  const lines: string[] = [];
  const header = `[${ym}] slots summary (registered/reserved/free | -> first open)`;
  for (let d = 1; d <= last; d++) {
    const date = `${ym}-${String(d).padStart(2, "0")}`;
    const raw = await env.LINE_BOOKING.get(K_SLOTS(date));
    const slots: string[] = raw ? JSON.parse(raw) : [];
    const it = await env.LINE_BOOKING.list({ prefix: `R:${date} `, limit: 1000 });
    const taken = new Set(it.keys.map(k => k.name.substring(`R:${date} `.length)));
    const total = slots.length;
    const reserved = slots.filter(t => taken.has(t)).length;
    const free = Math.max(total - reserved, 0);
    const firstFree = slots.find(t => !taken.has(t));
    const dow = dayOfWeekLabel(yy, mm, d);
    lines.push(`${dow} ${date} | ${total}/${reserved}/${free}${firstFree ? ` | -> ${firstFree}` : ""}`);
  }
  return await lineReply(env, replyToken, [header, ...lines].join("\n"));
}

async function handleList(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return await lineReply(env, replyToken, "Usage: /list YYYY-MM-DD | YYYY-MM");
  const arg = args[0];
  const month = normalizeMonthArg(arg);
  if (month) return await listMonth(env, month, replyToken);
  const date = normalizeDateArg(arg);
  if (!date) return await lineReply(env, replyToken, "Bad date format (ex: 2025-10-05 or 2025-10)");
  const prefix = `R:${date} `;
  const it = await env.LINE_BOOKING.list({ prefix, limit: 1000 });
  const rows: { time: string; userId: string; service: string }[] = [];
  for (const k of it.keys) {
    const v = await env.LINE_BOOKING.get(k.name); if (!v) continue;
    const r = JSON.parse(v);
    rows.push({ time: k.name.substring(prefix.length), userId: r.userId, service: r.service });
  }
  rows.sort((a, b) => a.time.localeCompare(b.time));
  return await lineReply(
    env, replyToken,
    rows.length
      ? "[bookings of the day]\n" + rows.map(r => `- ${r.time} ${r.service} (${r.userId})`).join("\n")
      : "No bookings for that day."
  );
}

async function handleCopySlots(env: Env, args: string[], replyToken: string) {
  if (args.length < 2) return await lineReply(env, replyToken, "Usage: /copy-slots YYYY-MM-DD YYYY-MM-DD");
  const src = normalizeDateArg(args[0]); const dst = normalizeDateArg(args[1]);
  if (!src || !dst) return await lineReply(env, replyToken, "Bad date format (ex: 2025-10-05)");
  const s = await env.LINE_BOOKING.get(K_SLOTS(src));
  const slots: string[] = s ? JSON.parse(s) : [];
  const normalized = Array.from(new Set(slots)).sort();
  await env.LINE_BOOKING.put(K_SLOTS(dst), JSON.stringify(normalized));
  return await lineReply(env, replyToken, `OK: copied slots.\n${src} -> ${dst}\n${normalized.join(", ")}`);
}

async function handleReport(env: Env, args: string[], replyToken: string) {
  if (args.length < 1) return await lineReply(env, replyToken, "Usage: /report YYYY-MM");
  const ymRaw = args[0].normalize("NFKC");
  const ym = normalizeMonthArg(ymRaw);
  if (!ym) return await lineReply(env, replyToken, "Bad month format (ex: 2025-10)");
  const prefix = `R:${ym}-`;
  const it = await env.LINE_BOOKING.list({ prefix, limit: 2000 });
  const dayCount: Record<string, number> = {};
  const byService: Record<string, number> = {};
  for (const k of it.keys) {
    const m = /^R:(\d{4}-\d{2}-\d{2})\s(.+)$/.exec(k.name);
    if (!m) continue;
    const d = m[1]; dayCount[d] = (dayCount[d] || 0) + 1;
    const recStr = await env.LINE_BOOKING.get(k.name); if (!recStr) continue;
    try {
      const rec = JSON.parse(recStr);
      const s = String(rec.service || "unknown");
      byService[s] = (byService[s] || 0) + 1;
    } catch {}
  }
  const days = Object.entries(dayCount).sort((a,b)=>a[0].localeCompare(b[0]))
               .map(([d,c])=>`- ${d} : ${c}`).join("\n") || "(none)";
  const svc  = Object.entries(byService).sort((a,b)=>b[1]-a[1])
               .map(([s,c])=>`- ${s} : ${c}`).join("\n") || "(none)";
  const total = Object.values(dayCount).reduce((a,b)=>a+b,0);
  return await lineReply(env, replyToken, [`[report ${ym}] total ${total}`, "-- by day --", days, "-- by service --", svc].join("\n"));
}

// ===== whoami / ping =====
function maskId(s?: string) { return s ? s.slice(0,4) + "..." + s.slice(-4) : "unknown"; }

async function whoAmI(ev: any, env: Env, admins: Set<string>, raw: boolean): Promise<string> {
  const src = ev?.source || {};
  const uid = src.userId as string | undefined;
  const gid = src.groupId as string | undefined;
  const rid = src.roomId  as string | undefined;

  let prof: any = null;
  try {
    if (uid) {
      let url = `https://api.line.me/v2/bot/profile/${uid}`;
      if (gid) url = `https://api.line.me/v2/bot/group/${gid}/member/${uid}`;
      if (rid) url = `https://api.line.me/v2/bot/room/${rid}/member/${uid}`;
      const r = await fetch(url, { headers: { Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}` } });
      if (r.ok) prof = await r.json();
    }
  } catch {}

  const lines = [
    "whoami",
    `type: ${src.type || "unknown"}`,
    `userId: ${raw ? (uid || "unknown") : maskId(uid)}`,
    gid ? `groupId: ${raw ? gid : maskId(gid)}` : undefined,
    rid ? `roomId: ${raw ? rid : maskId(rid)}` : undefined,
    `isAdmin: ${isAdmin(uid, admins) ? "YES" : "NO"}`,
    prof?.displayName ? `name: ${prof.displayName}` : undefined,
    prof?.language ? `lang: ${prof.language}` : undefined,
  ].filter(Boolean);

  return lines.join("\n");
}

async function handlePing(env: Env, replyToken: string) {
  await lineReply(env, replyToken, "pong");
}

// ===== Event processor =====
async function processLineEvent(ev: any, env: Env, adminsSet: Set<string>) {
  const replyToken: string | undefined = ev.replyToken;
  const messageText: string | undefined = ev.message?.text;
  const userId: string | undefined = ev.source?.userId;
  const userName: string | undefined = ev.source?.userId; // 必要なら displayName に置換OK
  if (!replyToken || !messageText || !userId) return;

  if (!(await rateLimit(env, userId))) {
    await lineReply(env, replyToken, "Too many requests. Please wait a bit.");
    return;
  }

  const z = messageText.normalize("NFKC").trim();
  const [cmdRaw, ...rest] = z.split(/\s+/);
  const cmd = (cmdRaw || "").toLowerCase();

  console.log("PROCESS_EVENT", { cmd, userId: maskId(userId) });

  try {
    if (cmd === "/set-slots" || cmd === "set-slots") {
      if (!isAdmin(userId, adminsSet)) { await lineReply(env, replyToken, "🚫 Admin only. Use /whoami raw and add your userId to ADMINS."); return; }
      await handleSetSlots(env, rest, replyToken);
    } else if (cmd === "/slots" || cmd === "slots") {
      await handleSlots(env, rest, replyToken);
    } else if (cmd === "/reserve" || cmd === "reserve") {
      await handleReserve(env, z, replyToken, userId, userName);
    } else if (cmd === "/my" || cmd === "my") {
      await handleMy(env, rest, replyToken, userId);
    } else if (cmd === "/cancel" || cmd === "cancel") {
      await handleCancel(env, rest, replyToken, userId);
    } else if (cmd === "/list" || cmd === "list") {
      if (!isAdmin(userId, adminsSet)) { await lineReply(env, replyToken, "🚫 Admin only. Use /whoami raw and add your userId to ADMINS."); return; }
      await handleList(env, rest, replyToken);
    } else if (cmd === "/copy-slots" || cmd === "copy-slots") {
      if (!isAdmin(userId, adminsSet)) { await lineReply(env, replyToken, "🚫 Admin only. Use /whoami raw and add your userId to ADMINS."); return; }
      await handleCopySlots(env, rest, replyToken);
    } else if (cmd === "/report" || cmd === "report") {
      if (!isAdmin(userId, adminsSet)) { await lineReply(env, replyToken, "🚫 Admin only. Use /whoami raw and add your userId to ADMINS."); return; }
      await handleReport(env, rest, replyToken);
    } else if (cmd === "/whoami" || cmd === "whoami") {
      const wantRaw = (rest[0]?.toLowerCase() === "raw");
      await lineReply(env, replyToken, await whoAmI(ev, env, adminsSet, wantRaw));
    } else if (cmd === "/ping" || cmd === "ping") {
      await handlePing(env, replyToken);
    } else {
      await lineReply(env, replyToken, [
        "Commands:",
        "/set-slots YYYY-MM-DD 10:00,11:00,16:30",
        "/slots YYYY-MM-DD",
        "/reserve YYYY-MM-DD HH:MM [service]",
        "/my [YYYY-MM-DD|YYYY-MM]",
        "/cancel YYYY-MM-DD HH:MM",
        "/list YYYY-MM-DD | YYYY-MM",
        "/copy-slots YYYY-MM-DD YYYY-MM-DD",
        "/report YYYY-MM",
        "/whoami (add 'raw' to show full IDs)",
        "/ping",
      ].join("\n"));
    }
  } catch (e) {
    await notifySlack(env, "WEBHOOK_CMD_FAIL", { cmd, err: (e as any)?.message || String(e) });
    await lineReply(env, replyToken, "Internal error. Please try again.");
  }
}

// ===== Router（診断ルート＋到達ログつき）=====
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    try {
      const url = new URL(req.url);
      const path = url.pathname.replace(/\/+$/, "");

      const FEATURES = { monthList: true, flexibleSlots: true, whoami: true } as const;

      if (path === "/__health" && req.method === "GET") {
        return new Response(
          JSON.stringify({ ok: true, ts: Date.now(), env: env.BASE_URL || "default", features: FEATURES }),
          { headers: { "content-type": "application/json" } }
        );
      }

      // 診断: 管理者へ PUSH（アクセストークン検証）
      if (path === "/__diag/push" && req.method === "GET") {
        const admins = (env.ADMINS || "").split(/[,、\s]+/).filter(Boolean);
        if (!admins.length) return new Response("no ADMINS", { status: 400 });

        const r = await fetch("https://api.line.me/v2/bot/message/push", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            to: admins[0],
            messages: [{ type: "text", text: `diag push ${new Date().toISOString()}` }],
          }),
        });
        const body = await r.text().catch(() => "");
        console.log("LINE_PUSH_RESULT", r.status, body);
        return new Response(r.ok ? "push ok" : `push fail ${r.status}`, { status: r.ok ? 200 : 500 });
      }

      if (path === "/api/line/webhook" && req.method === "POST") {
        // ★まず到達ログ（ここで 401/403 は返さない）
        const ua  = req.headers.get("user-agent") || "";
        const sig = req.headers.get("x-line-signature") || "";
        console.log("HIT /api/line/webhook", "ua=", ua, "sigLen=", sig.length);

        const raw = await req.text();

        // 署名検証
        const ok = await verifyLineSignature(req, env, raw);
        if (!ok) {
          console.log("LINE_SIGNATURE_BAD");
          return new Response("invalid signature", { status: 403 });
          // 診断モードで通したい場合は上記をコメントアウトし、下行に切替
          // return new Response("ok (diag, sig bad)", { status: 200 });
        }

        // ★ 古いイベントはスキップ + 充実ログ（本処理は waitUntil に逃がす）
        ctx.waitUntil((async () => {
          try {
            const body = JSON.parse(raw || "{}");
            const events = body.events || [];
            const adminsSet = parseAdmins(env.ADMINS);
            const now = Date.now();

            console.log("LINE_EVENT_COUNT", events.length);

            for (const ev of events) {
              if (isStaleEvent(ev, now)) {
                console.log("STALE_EVENT_SKIP", ev?.timestamp ?? null);
                continue;
              }
              console.log("LINE_EVENT_TYPE", ev?.type, ev?.message?.type);
              await processLineEvent(ev, env, adminsSet);
            }
          } catch (e) {
            console.log("UNCAUGHT_WEBHOOK_TASK", String(e));
          }
        })());

        // Webhookは即200返す（返信APIは waitUntil 内で実行）
        return new Response("ok", { status: 200, headers: { "content-type": "text/plain" } });
      }

      if (path === "/" && req.method === "GET") {
        return new Response("OK / SaaS Booking Worker");
      }

      return new Response("Not Found", { status: 404 });
    } catch (e) {
      console.log("UNCAUGHT_FETCH_ERROR", String(e));
      return new Response("Internal Server Error", {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
      });
    }
  },
};
