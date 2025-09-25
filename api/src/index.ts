// api/src/index.ts
// Cloudflare Workers (TypeScript) + LINE Messaging API
// 予約ボット: /help /version /debug /__ping
//            /set-slots YYYY-MM-DD HH:mm,HH:mm,...  (空き登録)
//            /slots     YYYY-MM-DD|M/D             (空き一覧=🟢/❌表示)
//            /reserve   YYYY-MM-DD HH:mm [メモ]     (予約)
//            /my /cancel <ID> /inspect /cleanup
//
// KV:
//  slots:<date>                  -> '["10:00","11:30",...]'
//  taken:<date>T<time>           -> '<reserveId>'   (アクティブ予約がある時だけ存在)
//  reserve:<id>                  -> Reserve(JSON)
//  user:<uid>:list               -> '["id1","id2",...]'
//
// 必須: [[kv_namespaces]] binding = "LINE_BOOKING"
// 必須シークレット: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET
// 任意: BASE_URL

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_SECRET: string;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  BASE_URL?: string;
}

type LineEvent = {
  type: "message";
  replyToken: string;
  source: { userId?: string };
  message: { type: "text"; text: string };
};
type LineWebhookBody = { events: LineEvent[] };

const VERSION = "v2.8.0-slots-mark"; // 表示用

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/__ping") return new Response("ok", { status: 200 });
    if (req.method !== "POST") return new Response("ng", { status: 405 });

    const raw = await req.text();
    if (!(await verifyLineSignature(raw, req.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET))) {
      return new Response("signature error", { status: 401 });
    }

    const body: LineWebhookBody = JSON.parse(raw);
    for (const ev of body.events || []) {
      if (ev.type !== "message" || ev.message?.type !== "text") continue;

      const replyToken = ev.replyToken;
      const userId = ev.source.userId;
      const text = (ev.message.text || "").trim();

      if (!userId) {
        await replyText(env, replyToken, "ユーザーIDが取得できませんでした🙇");
        continue;
      }

      // 内部ユーティリティ
      if (text === "/version") {
        await replyText(env, replyToken, `🧩 ${VERSION}`);
        continue;
      }
      if (text === "/help" || text === "ヘルプ") {
        await replyText(
          env,
          replyToken,
          [
            "📖 使い方：",
            "・空き登録: `/set-slots 2025-09-25 10:00,11:30,14:00`",
            "・空き確認: `/slots 2025-09-25`",
            "・予約: `/reserve 2025-09-25 10:00 カット`",
            "・一覧: `/my`",
            "・取消: `/cancel <ID>`",
            "・衝突確認: `/inspect 2025-09-25 10:00`",
            "・掃除: `/cleanup`",
          ].join("\n")
        );
        continue;
      }
      if (text.startsWith("/debug")) {
        const payload = text.replace(/^\/debug\s*/, "");
        const hex = [...new TextEncoder().encode(payload)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");
        await replyText(env, replyToken, `RAW: ${payload}\nHEX: ${hex}\nNORM: ${normalizeSpaces(payload)}`);
        continue;
      }

      // スロット系
      if (text.startsWith("/set-slots")) {
        await handleSetSlots(env, replyToken, text);
        continue;
      }
      if (text.startsWith("/slots")) {
        await handleSlots(env, replyToken, text);
        continue;
      }

      // 予約系
      if (text.startsWith("/reserve")) {
        await handleReserve(env, replyToken, userId, text);
        continue;
      }
      if (text === "/my") {
        await handleMy(env, replyToken, userId);
        continue;
      }
      if (text.startsWith("/cancel")) {
        await handleCancel(env, replyToken, userId, text);
        continue;
      }
      if (text.startsWith("/inspect")) {
        await handleInspect(env, replyToken, text);
        continue;
      }
      if (text === "/cleanup") {
        await handleCleanup(env, replyToken, userId);
        continue;
      }

      // デフォルト応答
      await replyText(
        env,
        replyToken,
        "予約するなら `/reserve 2025-09-25 10:00 カット` って打ってね 🧑‍🔧\n空き枠は `/slots 2025-09-25` だよ💡"
      );
    }

    return new Response("OK");
  },
};

// ========== LINE util ==========
async function replyText(env: Env, replyToken: string, text: string) {
  const endpoint = "https://api.line.me/v2/bot/message/reply";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
  if (!res.ok) console.error("LINE reply error", await res.text());
}

async function verifyLineSignature(body: string, got: string | null, secret: string) {
  if (!got) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hash = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return safeEqual(hash, got);
}
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// ========== Helpers ==========
const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();

const dKey = (dateISO: string) => `slots:${dateISO}`;
const lockKey = (dateISO: string, time: string) => `taken:${dateISO}T${time}`;
const userListKey = (userId: string) => `user:${userId}:list`;
const reserveKey = (id: string) => `reserve:${id}`;

type Reserve = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  memo?: string;
  status: "active" | "canceled";
  createdAt: string; // ISO
};

async function shortId() {
  const a = crypto.getRandomValues(new Uint8Array(4));
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function parseDateToken(tok: string): string | null {
  tok = tok.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return tok;
  const m = tok.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const y = new Date().getFullYear();
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${y}-${mm}-${dd}`;
  }
  return null;
}
function parseTimeToken(tok: string): string | null {
  tok = tok.trim();
  if (/^\d{1,2}:\d{2}$/.test(tok)) {
    const [h, m] = tok.split(":");
    return `${h.padStart(2, "0")}:${m}`;
  }
  return null;
}

// ========== Handlers ==========
async function handleSetSlots(env: Env, replyToken: string, text: string) {
  const norm = normalizeSpaces(text);
  const m = norm.match(/^\/set-slots\s+(\d{4}-\d{2}-\d{2})\s+([0-9:,]+)$/);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/set-slots 2025-09-25 10:00,11:30,14:00`");
    return;
  }
  const dateISO = m[1];
  const times = m[2]
    .split(",")
    .map((x) => x.trim())
    .filter((x) => /^\d{1,2}:\d{2}$/.test(x))
    .map((t) => {
      const [h, mm] = t.split(":");
      return `${h.padStart(2, "0")}:${mm}`;
    });

  await env.LINE_BOOKING.put(dKey(dateISO), JSON.stringify(times));
  await replyText(env, replyToken, `✅ ${dateISO} の枠を更新したよ。\n${times.join(", ")}`);
}

async function handleSlots(env: Env, replyToken: string, text: string) {
  // 例: /slots 2025-09-25  |  /slots 9/25
  const norm = normalizeSpaces(text);
  const m = norm.match(/^\/slots\s+(.+)$/);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/slots 2025-09-25`");
    return;
  }
  const dateISO = parseDateToken(m[1]);
  if (!dateISO) {
    await replyText(env, replyToken, "日付は `YYYY-MM-DD` か `M/D` で指定してね");
    return;
  }

  const val = await env.LINE_BOOKING.get(dKey(dateISO));
  if (!val) {
    await replyText(env, replyToken, `⚠️ ${dateISO} の枠は未設定だよ`);
    return;
  }
  const times: string[] = JSON.parse(val);

  // 予約済み（taken:YYYY-MM-DDT…）を列挙して、「埋まり時間」を特定
  const takenTimes = await listTakenTimes(env, dateISO);

  // 表示
  const lines = times.map((t) => (takenTimes.has(t) ? `❌ ${t}（埋まり）` : `🟢 ${t}（空き）`));
  await replyText(env, replyToken, `📅 ${dateISO} の枠\n${lines.join("\n")}`);
}

async function handleReserve(env: Env, replyToken: string, userId: string, text: string) {
  const norm = normalizeSpaces(text);
  const m = norm.match(/^\/reserve\s+(\S+)\s+(\S+)(?:\s+(.+))?$/);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/reserve 2025-09-25 10:00 カット`");
    return;
  }
  const d = parseDateToken(m[1]);
  const t = parseTimeToken(m[2]);
  const memo = m[3] || "";
  if (!d || !t) {
    await replyText(env, replyToken, "日付/時間の形式が違うよ（`YYYY-MM-DD HH:mm`）");
    return;
  }

  // スロットに存在するか
  const sv = await env.LINE_BOOKING.get(dKey(d));
  if (!sv) {
    await replyText(env, replyToken, `⚠️ ${d} の空き枠が未登録。先に \`/set-slots ${d} 10:00,11:30\` で設定してね`);
    return;
  }
  const slots: string[] = JSON.parse(sv);
  if (!slots.includes(t)) {
    await replyText(env, replyToken, `⚠️ ${d} ${t} は空き枠に含まれていません。登録済み: ${slots.join(", ")}`);
    return;
  }

  // 既予約チェック（takenキー）
  const tk = lockKey(d, t);
  const existing = await env.LINE_BOOKING.get(tk);
  if (existing) {
    const r = await getReserve(env, existing);
    if (r && r.status === "active") {
      await replyText(
        env,
        replyToken,
        ["⚠️ その日時は既に予約があります。", `ID: ${r.id}`, `日時: ${r.date} ${r.time}`, `内容: ${r.memo || "-"}`, "", "別の時間で予約してね🙏`"].join(
          "\n"
        )
      );
      return;
    }
  }

  const id = await shortId();
  const reserve: Reserve = {
    id,
    userId,
    date: d,
    time: t,
    memo,
    status: "active",
    createdAt: new Date().toISOString(),
  };
  await env.LINE_BOOKING.put(reserveKey(id), JSON.stringify(reserve));
  await env.LINE_BOOKING.put(tk, id);
  await pushUserList(env, userId, id);

  await replyText(
    env,
    replyToken,
    ["✅ 予約を保存したよ！", `ID: ${id}`, `日時: ${d} ${t}`, `内容: ${memo || "-"}`, "", "確認は `/my`, キャンセルは `/cancel " + id + "`"].join("\n")
  );
}

async function handleMy(env: Env, replyToken: string, userId: string) {
  const ids = await readUserList(env, userId);
  if (!ids.length) {
    await replyText(env, replyToken, "（まだ予約はないよ）");
    return;
  }
  const arr: Reserve[] = [];
  for (const id of ids) {
    const r = await getReserve(env, id);
    if (r) arr.push(r);
  }
  arr.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  const lines: string[] = ["📝 あなたの予約（最新10件）"];
  for (const r of arr.slice(0, 10)) {
    const mark = r.status === "active" ? "🟢" : "❌";
    lines.push(`${mark} ${r.id}  ${r.date} ${r.time}  ${r.memo || "－"}`);
  }
  lines.push("", "キャンセルは `/cancel <ID>`");
  await replyText(env, replyToken, lines.join("\n"));
}

async function handleCancel(env: Env, replyToken: string, userId: string, text: string) {
  const m = text.match(/^\/cancel\s+([a-f0-9]{8})$/i);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/cancel 1234abcd`");
    return;
  }
  const id = m[1];
  const r = await getReserve(env, id);
  if (!r) {
    await replyText(env, replyToken, `ID ${id} の予約が見つからないよ😢`);
    return;
  }
  if (r.userId !== userId) {
    await replyText(env, replyToken, "この予約はあなたのものではないみたい🙇");
    return;
  }
  if (r.status === "canceled") {
    await replyText(env, replyToken, `ID ${id} はすでにキャンセル済みだよ🟡`);
    return;
  }

  r.status = "canceled";
  await env.LINE_BOOKING.put(reserveKey(id), JSON.stringify(r));
  await env.LINE_BOOKING.delete(lockKey(r.date, r.time)); // 枠解放

  await replyText(env, replyToken, ["✅ キャンセル完了！", `ID: ${r.id}`, `日時: ${r.date} ${r.time}`, `内容: ${r.memo || "-"}`].join("\n"));
}

async function handleInspect(env: Env, replyToken: string, text: string) {
  const norm = normalizeSpaces(text);
  const m = norm.match(/^\/inspect\s+(\S+)\s+(\S+)$/);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/inspect 2025-09-25 15:00`");
    return;
  }
  const d = parseDateToken(m[1]);
  const t = parseTimeToken(m[2]);
  if (!d || !t) {
    await replyText(env, replyToken, "日付/時間の形式が違うよ（`YYYY-MM-DD HH:mm`）");
    return;
  }
  const lock = await env.LINE_BOOKING.get(lockKey(d, t));
  const out = [`userid: (secret)`, `iso: ${d}T${t}:00+09:00`, `id(deterministic): ${await shortId()}`, `lock:<${lock || "none"}>`].join("\n");
  await replyText(env, replyToken, out);
}

async function handleCleanup(env: Env, replyToken: string, userId: string) {
  const ids = await readUserList(env, userId);
  let kept = 0;
  let removed = 0;
  for (const id of ids) {
    const r = await getReserve(env, id);
    if (r) kept++;
    else removed++;
  }
  await replyText(env, replyToken, `🧹 お掃除完了！\n保持: ${kept} 件\n自動キャンセル: ${removed} 件`);
}

// ========== KV helpers ==========
async function listTakenTimes(env: Env, dateISO: string): Promise<Set<string>> {
  // taken:YYYY-MM-DDT の prefix で列挙 → 末尾の HH:mm を抽出
  const prefix = `taken:${dateISO}T`;
  const times = new Set<string>();
  // ページング対応（KV.listは最大1000件/ページ）
  let cursor: string | undefined = undefined;
  do {
    const page = await env.LINE_BOOKING.list({ prefix, cursor });
    for (const k of page.keys) {
      // k.name = taken:YYYY-MM-DDTHH:mm
      const t = k.name.substring(prefix.length);
      if (/^\d{2}:\d{2}$/.test(t)) times.add(t);
    }
    cursor = page.cursor;
  } while (cursor);
  return times;
}

async function getReserve(env: Env, id: string): Promise<Reserve | null> {
  const v = await env.LINE_BOOKING.get(reserveKey(id));
  return v ? (JSON.parse(v) as Reserve) : null;
}
async function readUserList(env: Env, userId: string): Promise<string[]> {
  const v = await env.LINE_BOOKING.get(userListKey(userId));
  if (!v) return [];
  try {
    const arr = JSON.parse(v);
    return Array.isArray(arr) ? (arr as string[]) : [];
  } catch {
    return [];
  }
}
async function pushUserList(env: Env, userId: string, id: string) {
  const cur = await readUserList(env, userId);
  const next = [id, ...cur].slice(0, 50);
  await env.LINE_BOOKING.put(userListKey(userId), JSON.stringify(next));
}
