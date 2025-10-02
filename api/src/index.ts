// api/src/index.ts
// Cloudflare Workers (TypeScript) — LINE 予約ボット一体型
// - /__ping                      -> ok
// - /__debug/slots?date=YYYY-MM-DD -> { date, slots, avail, reserved }
// - POST /api/line/webhook       -> LINEメッセージ処理
//
// 必要なバインディング（wrangler.toml で定義済み想定）
// [[kv_namespaces]]
// binding = "LINE_BOOKING"
// id      = "..."
// preview_id = "..."
//
// 環境シークレット（ダッシュボード or `wrangler secret`）
// - LINE_CHANNEL_ACCESS_TOKEN
// - LINE_CHANNEL_SECRET

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
}

// ---------- 小物ユーティリティ ----------
const te = new TextEncoder();
const td = new TextDecoder();

const norm = (s: string) =>
  s.replace(/\u3000/g, " ")  // 全角スペース→半角
   .replace(/\s+/g, " ")     // 連続空白を1つに
   .trim();

const normDate = (s: string) => s.replace(/\//g, "-"); // 2025/09/26 -> 2025-09-26

const splitCmd = (text: string) => {
  const t = norm(text);
  const parts = t.split(" ");
  const cmd = (parts[0] || "").toLowerCase();
  const args = parts.slice(1);
  return { cmd, args };
};

const json = (obj: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(obj), {
    headers: { "content-type": "application/json; charset=utf-8" },
    ...init,
  });

// ArrayBuffer -> Base64
function abToBase64(ab: ArrayBuffer): string {
  let bin = "";
  const bytes = new Uint8Array(ab);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // @ts-ignore
  return btoa(bin);
}

// ---------- KV 格納キー設計 ----------
// slots:<date>             -> '10:00,11:30,14:00,16:30'
// resv:<date>:<time>       -> JSON { userId, menu, ts }
// user:<userId>:<date>:<time> -> JSON { menu, ts }
const kSlots = (date: string) => `slots:${date}`;
const kResv = (date: string, time: string) => `resv:${date}:${time}`;
const kUser = (user: string, date: string, time: string) =>
  `user:${user}:${date}:${time}`;

// ---------- LINE 返信 ----------
async function lineReply(env: Env, replyToken: string, messages: { type: "text"; text: string }[]) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.log("[line] reply failed", res.status, t);
  }
}

const t = (text: string) => ({ type: "text", text } as const);

// ---------- 署名検証 ----------
async function verifyLineSignature(env: Env, req: Request, rawBody: Uint8Array): Promise<boolean> {
  const sig = req.headers.get("x-line-signature");
  if (!sig) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    te.encode(env.LINE_CHANNEL_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, rawBody);
  const base64 = abToBase64(mac);
  return base64 === sig;
}

// ---------- スロット/予約ロジック ----------
async function setSlots(env: Env, date: string, times: string[]) {
  await env.LINE_BOOKING.put(kSlots(date), times.join(","));
}

async function getSlots(env: Env, date: string): Promise<string[]> {
  const s = await env.LINE_BOOKING.get(kSlots(date));
  return s ? s.split(",").map((x) => x.trim()).filter(Boolean) : [];
}

async function getReservedTimes(env: Env, date: string): Promise<string[]> {
  const list = await env.LINE_BOOKING.list({ prefix: `resv:${date}:` });
  return list.keys
    .map((k) => k.name.split(":")[2])
    .filter(Boolean)
    .sort();
}

async function debugSlots(env: Env, date: string) {
  const slots = await getSlots(env, date);
  const reserved = await getReservedTimes(env, date);
  const reservedSet = new Set(reserved);
  const avail = slots.filter((s) => !reservedSet.has(s));
  return { date, slots, avail, reserved };
}

async function reserve(env: Env, userId: string, date: string, time: string, menu?: string) {
  // すでに埋まっている？
  const exists = await env.LINE_BOOKING.get(kResv(date, time));
  if (exists) return false;

  const data = { userId, menu: menu ?? "", ts: Date.now() };
  await env.LINE_BOOKING.put(kResv(date, time), JSON.stringify(data));
  await env.LINE_BOOKING.put(kUser(userId, date, time), JSON.stringify({ menu: menu ?? "", ts: data.ts }));
  return true;
}

async function cancel(env: Env, userId: string, date: string, time: string, menu?: string) {
  const v = await env.LINE_BOOKING.get(kResv(date, time), "json") as any | null;
  if (!v) return false;
  // 自分の予約のみキャンセル（メニューは省略可。指定あれば一致確認）
  if (v.userId !== userId) return false;
  if (menu && norm(v.menu ?? "") !== norm(menu)) return false;

  await env.LINE_BOOKING.delete(kResv(date, time));
  await env.LINE_BOOKING.delete(kUser(userId, date, time));
  return true;
}

async function listMy(env: Env, userId: string, date?: string) {
  const prefix = date ? `user:${userId}:${date}:` : `user:${userId}:`;
  const list = await env.LINE_BOOKING.list({ prefix });
  const out: { date: string; time: string; menu?: string; ts: number }[] = [];
  for (const k of list.keys) {
    const [, , d, time] = k.name.split(":");
    const v = await env.LINE_BOOKING.get(k.name, "json") as any | null;
    if (!v) continue;
    out.push({ date: d, time, menu: v.menu, ts: v.ts ?? 0 });
  }
  out.sort((a, b) => a.ts - b.ts);
  return out;
}

// ---------- コマンド実装 ----------
async function handleText(env: Env, userId: string, replyToken: string, rawText: string) {
  const { cmd, args } = splitCmd(rawText);

  // /my [YYYY-MM-DD]
  if (cmd === "/my") {
    const date = args[0] ? normDate(args[0]) : undefined;
    const my = await listMy(env, userId, date);
    const lines = my.length
      ? my.map(x => `・${x.date} ${x.time}${x.menu ? ` ${x.menu}` : ""}`)
      : ["（予約はありません）"];
    await lineReply(env, replyToken, [t(["あなたの予約", ...lines].join("\n"))]);
    return;
  }

  // /cancel YYYY-MM-DD HH:MM [MENU]
  if (cmd === "/cancel") {
    if (args.length < 2) {
      await lineReply(env, replyToken, [t("使い方: /cancel 2025-09-26 16:30 [メニュー]")]);
      return;
    }
    const date = normDate(args[0]);
    const time = args[1];
    const menu = args.length >= 3 ? norm(args.slice(2).join(" ")) : undefined;

    const ok = await cancel(env, userId, date, time, menu);
    await lineReply(
      env,
      replyToken,
      [t(ok
        ? `✅ 予約をキャンセルしました。\n日時: ${date} ${time}${menu ? `\n内容: ${menu}` : ""}`
        : `⚠️ 該当の予約が見つかりませんでした。\n例: /cancel 2025-09-26 16:30 カット`)]
    );
    return;
  }

  // /set-slots YYYY-MM-DD hh:mm,hh:mm,...
  if (cmd === "/set-slots") {
    if (args.length < 2) {
      await lineReply(env, replyToken, [t("使い方: /set-slots 2025-09-26 10:00,11:30,14:00,16:30")]);
      return;
    }
    const date = normDate(args[0]);
    const times = args[1].split(",").map(s => s.trim()).filter(Boolean);
    await setSlots(env, date, times);
    await lineReply(env, replyToken, [t(`✅ ${date} の枠を更新したよ。\n${times.join(", ")}`)]);
    return;
  }

  // /slots YYYY-MM-DD
  if (cmd === "/slots") {
    if (args.length < 1) {
      await lineReply(env, replyToken, [t("使い方: /slots 2025-09-26")]);
      return;
    }
    const date = normDate(args[0]);
    const dbg = await debugSlots(env, date);
    const body =
      `🗓 ${dbg.date} の空き状況\n` +
      `空き: ${dbg.avail.length ? dbg.avail.join(", ") : "なし"}\n` +
      `予約済: ${dbg.reserved.length ? dbg.reserved.join(", ") : "なし"}`;
    await lineReply(env, replyToken, [t(body)]);
    return;
  }

  // /reserve YYYY-MM-DD HH:MM [MENU]
  if (cmd === "/reserve") {
    if (args.length < 2) {
      await lineReply(env, replyToken, [t("使い方: /reserve 2025-09-26 10:00 カット")]);
      return;
    }
    const date = normDate(args[0]);
    const time = args[1];
    const menu = args.length >= 3 ? norm(args.slice(2).join(" ")) : undefined;

    // 候補チェック
    const slots = await getSlots(env, date);
    if (!slots.includes(time)) {
      await lineReply(
        env,
        replyToken,
        [t(`⚠️ その時間は候補にないよ。\n候補: ${slots.length ? slots.join(", ") : "（未設定）"}`)]
      );
      return;
    }
    const ok = await reserve(env, userId, date, time, menu);
    await lineReply(
      env,
      replyToken,
      [t(ok
        ? `✅ 予約を登録したよ。\n日時: ${date} ${time}\n内容: ${menu ?? "（未指定）"}`
        : "⚠️ すでに埋まっています。別の時間を試してね。")]
    );
    return;
  }

  // 未対応
  await lineReply(env, replyToken, [t("使い方: /slots YYYY-MM-DD, /set-slots, /reserve, /my, /cancel")]);
}

// ---------- Webhook本体 ----------
async function handleLineWebhook(env: Env, req: Request) {
  const raw = new Uint8Array(await req.arrayBuffer());
  // 署名検証（失敗したら 401）
  const ok = await verifyLineSignature(env, req, raw);
  if (!ok) return new Response("invalid signature", { status: 401 });

  const body = JSON.parse(td.decode(raw));
  const events = body.events ?? [];
  for (const ev of events) {
    const replyToken = ev.replyToken;
    if (ev.type === "message" && ev.message?.type === "text") {
      const userId = ev.source?.userId as string | undefined;
      if (!replyToken || !userId) continue;
      await handleText(env, userId, replyToken, ev.message.text);
    }
  }
  return new Response("ok");
}

// ---------- Fetch ルーター ----------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    // 1) ヘルス
    if (req.method === "GET" && url.pathname === "/__ping") {
      return new Response("ok", { headers: { "content-type": "text/plain" } });
    }

    // 2) スロットデバッグ
    if (req.method === "GET" && url.pathname === "/__debug/slots") {
      const date = normDate(url.searchParams.get("date") || "");
      if (!date) return json({ error: "date required" }, { status: 400 });
      const data = await debugSlots(env, date);
      return json(data);
    }

    // 3) LINE Webhook
    if (req.method === "POST" && url.pathname === "/api/line/webhook") {
      return handleLineWebhook(env, req);
    }

    return new Response("Not Found", { status: 404 });
  },
};
