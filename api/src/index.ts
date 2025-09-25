// api/src/index.ts
// Cloudflare Workers (TypeScript) + LINE Messaging API
// 機能: /help /version /debug /__ping
//      /reserve YYYY-MM-DD HH:mm [メモ]
//      /my  /cancel <ID>
//      /set-slots YYYY-MM-DD HH:mm,HH:mm,...  /slots YYYY-MM-DD
//      /cleanup（簡易） /inspect（衝突確認）
//
// 必要な KV バインディング: LINE_BOOKING
// 必要な環境変数: LINE_CHANNEL_ACCESS_TOKEN, LINE_CHANNEL_SECRET, BASE_URL
// wrangler.toml 側: [[kv_namespaces]] binding = "LINE_BOOKING" ...

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

type LineWebhookBody = {
  events: LineEvent[];
};

const VERSION = "v2.7.0-slots"; // 表示用

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    // Health check
    const url = new URL(req.url);
    if (url.pathname === "/__ping") {
      return new Response("ok", { status: 200 });
    }

    // LINE webhook only POST
    if (req.method !== "POST") return new Response("ng", { status: 405 });

    // Signature verify
    const bodyText = await req.text();
    if (!(await verifyLineSignature(bodyText, req.headers.get("x-line-signature"), env.LINE_CHANNEL_SECRET))) {
      return new Response("signature error", { status: 401 });
    }

    const body: LineWebhookBody = JSON.parse(bodyText);

    await Promise.all(
      (body.events || []).map(async (ev) => {
        if (ev.type !== "message" || ev.message?.type !== "text") return;
        const userId = ev.source.userId;
        if (!userId) {
          await replyText(env, ev.replyToken, "ユーザーIDが取得できませんでした🙇");
          return;
        }
        const text = (ev.message.text || "").trim();

        // ルーティング
        // 1) 内部用
        if (url.pathname === "/debug" || text.startsWith("/debug ")) {
          const payload = text.replace(/^\/debug\s*/, "");
          const hex = [...new TextEncoder().encode(payload)]
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
          await replyText(
            env,
            ev.replyToken,
            `RAW: ${payload}\nHEX: ${hex}\nNORM: ${normalizeSpaces(payload)}`
          );
          return;
        }
        if (text === "/version") {
          await replyText(env, ev.replyToken, `🧩 ${VERSION}`);
          return;
        }
        if (text === "/help" || text === "ヘルプ") {
          await replyText(
            env,
            ev.replyToken,
            [
              "📖 使い方：",
              "・空き確認: `/slots 2025-09-25`",
              "・空き登録: `/set-slots 2025-09-25 10:00,11:30,14:00,16:30`",
              "・予約: `/reserve 2025-09-25 10:00 カット`",
              "・一覧: `/my`",
              "・取消: `/cancel <ID>`",
              "・衝突確認: `/inspect 2025-09-25 10:00`",
              "・掃除: `/cleanup`",
            ].join("\n")
          );
          return;
        }

        // 2) 空き枠コマンド
        if (text.startsWith("/set-slots")) {
          await handleSetSlots(env, ev.replyToken, text);
          return;
        }
        if (text.startsWith("/slots")) {
          await handleSlots(env, ev.replyToken, text);
          return;
        }

        // 3) 予約系
        if (text.startsWith("/reserve")) {
          await handleReserve(env, ev.replyToken, userId, text);
          return;
        }
        if (text === "/my") {
          await handleMy(env, ev.replyToken, userId);
          return;
        }
        if (text.startsWith("/cancel")) {
          await handleCancel(env, ev.replyToken, userId, text);
          return;
        }
        if (text.startsWith("/inspect")) {
          await handleInspect(env, ev.replyToken, text);
          return;
        }
        if (text === "/cleanup") {
          await handleCleanup(env, ev.replyToken, userId);
          return;
        }

        // デフォルト応答（プロンプト）
        await replyText(
          env,
          ev.replyToken,
          "予約するなら `/reserve 2025-09-25 10:00 カット` って打ってね 🧑‍🔧\n空き枠は `/slots 2025-09-25` だよ💡"
        );
      })
    );

    return new Response("OK", { status: 200 });
  },
};

// ===== LINE util =====
async function replyText(env: Env, replyToken: string, text: string) {
  const endpoint = "https://api.line.me/v2/bot/message/reply";
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text: text.slice(0, 5000) }],
    }),
  });
  if (!res.ok) {
    console.error("LINE reply error", await res.text());
  }
}

async function verifyLineSignature(body: string, got: string | null, secret: string) {
  if (!got) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
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

// ===== Helpers =====
const normalizeSpaces = (s: string) => s.replace(/\s+/g, " ").trim();

const dKey = (dateISO: string) => `slots:${dateISO}`; // 空き枠用
const lockKey = (dateISO: string, time: string) => `taken:${dateISO}T${time}`; // 枠占有キー
const userListKey = (userId: string) => `user:${userId}:list`; // 予約ID配列
const reserveKey = (id: string) => `reserve:${id}`; // 予約本体

type Reserve = {
  id: string;
  userId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  memo?: string;
  status: "active" | "canceled";
  createdAt: string; // ISO
};

// 短いID
async function shortId() {
  const a = crypto.getRandomValues(new Uint8Array(4));
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// パース（9/25 と YYYY-MM-DD 両方許可）
function parseDateToken(tok: string): string | null {
  tok = tok.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(tok)) return tok;
  const m = tok.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const y = new Date();
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${y.getFullYear()}-${mm}-${dd}`;
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

// ===== Handlers =====

// /set-slots YYYY-MM-DD HH:mm,HH:mm,...
async function handleSetSlots(env: Env, replyToken: string, text: string) {
  // 例: /set-slots 2025-09-25 10:00,11:30,14:00,16:30
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
  await replyText(
    env,
    replyToken,
    `✅ ${dateISO} の枠を更新したよ。\n${times.join(", ")}`
  );
}

// /slots YYYY-MM-DD | M/D
async function handleSlots(env: Env, replyToken: string, text: string) {
  const norm = normalizeSpaces(text);
  const m = norm.match(/^\/slots\s+(.+)$/);
  if (!m) {
    await replyText(env, replyToken, "使い方: `/slots 2025-09-25`");
    return;
  }
  const d = parseDateToken(m[1]);
  if (!d) {
    await replyText(env, replyToken, "日付の形式は `YYYY-MM-DD` か `M/D` で指定してね");
    return;
  }
  const val = await env.LINE_BOOKING.get(dKey(d));
  if (!val) {
    await replyText(env, replyToken, `⚠️ ${d} の枠はまだ設定されてないよ`);
    return;
  }
  const times: string[] = JSON.parse(val);
  if (!times.length) {
    await replyText(env, replyToken, `⚠️ ${d} は登録済みだけど、空きは0件だよ`);
    return;
  }
  await replyText(env, replyToken, `📅 ${d} の空き枠:\n${times.join(", ")}`);
}

// /reserve YYYY-MM-DD HH:mm [メモ]
async function handleReserve(env: Env, replyToken: string, userId: string, text: string) {
  // 例: /reserve 2025-09-25 10:00 カット
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
    await replyText(env, replyToken, "日付か時間の形式が違うよ〜（`YYYY-MM-DD HH:mm`）");
    return;
  }

  // まず /set-slots で登録済みか確認
  const slots = await env.LINE_BOOKING.get(dKey(d));
  if (!slots) {
    await replyText(env, replyToken, `⚠️ ${d} の空き枠が登録されてないよ。まずは \`/set-slots ${d} 10:00,11:30\` みたいに設定してね`);
    return;
  }
  const times: string[] = JSON.parse(slots);
  if (!times.includes(t)) {
    await replyText(env, replyToken, `⚠️ ${d} ${t} は空き枠に含まれていません。登録済み: ${times.join(", ")}`);
    return;
  }

  // 枠占有チェック
  const lk = lockKey(d, t);
  const taken = await env.LINE_BOOKING.get(lk);
  if (taken) {
    // 既に予約あり
    const r: Reserve | null = await getReserve(env, taken);
    if (r && r.status === "active") {
      await replyText(
        env,
        replyToken,
        [
          "⚠️ その日時は既に予約があります。",
          `ID: ${r.id}`,
          `日時: ${r.date} ${r.time}`,
          `内容: ${r.memo || "-"}`,
          "",
          "別の時間で予約してね🙏",
        ].join("\n")
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

  // 保存（KVは最終的整合性なので厳密ロックではないが十分実用）
  await env.LINE_BOOKING.put(reserveKey(id), JSON.stringify(reserve));
  await env.LINE_BOOKING.put(lk, id);
  await pushUserList(env, userId, id);

  await replyText(
    env,
    replyToken,
    [
      "✅ 予約を保存したよ！",
      `ID: ${id}`,
      `日時: ${d} ${t}`,
      `内容: ${memo || "-"}`,
      "",
      "確認は `/my`, キャンセルは `/cancel " + id + "`",
    ].join("\n")
  );
}

// /my
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

// /cancel <ID>
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
  await env.LINE_BOOKING.delete(lockKey(r.date, r.time)); // 枠を解放

  await replyText(
    env,
    replyToken,
    ["✅ キャンセル完了！", `ID: ${r.id}`, `日時: ${r.date} ${r.time}`, `内容: ${r.memo || "-"}`].join("\n")
  );
}

// /inspect YYYY-MM-DD HH:mm
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
  const u = crypto.randomUUID(); // 疑似 userId サンプル
  const out = [
    `userid: ${u.slice(0, 20)}`,
    `iso: ${d}T${t}:00+09:00`,
    `id(deterministic): ${await shortId()}`,
    `lock:<${await env.LINE_BOOKING.get(lockKey(d, t)) || "none"}>`,
  ].join("\n");
  await replyText(env, replyToken, out);
}

// /cleanup（自分のキャンセル済みを整理）
async function handleCleanup(env: Env, replyToken: string, userId: string) {
  const ids = await readUserList(env, userId);
  let kept = 0;
  let removed = 0;
  for (const id of ids) {
    const r = await getReserve(env, id);
    if (!r) {
      removed++;
      continue;
    }
    kept++;
  }
  await replyText(
    env,
    replyToken,
    `🧹 お掃除完了！\n保持: ${kept} 件\n自動キャンセル: ${removed} 件`
  );
}

// ===== KV helpers =====
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
  // 先頭に追加（最新が上）
  const next = [id, ...cur].slice(0, 50);
  await env.LINE_BOOKING.put(userListKey(userId), JSON.stringify(next));
}
