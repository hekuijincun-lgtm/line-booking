// index.ts  (v2.9.0-slots-list)
// Cloudflare Workers + LINE Messaging API
// 必要なバインディング：KV「LINE_BOOKING」 / Secret「LINE_CHANNEL_ACCESS_TOKEN」
// BASE_URL は任意（/__ping などで使う）

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  BASE_URL?: string;
}

type LineEvent =
  | {
      type: "message";
      replyToken: string;
      source: { userId?: string };
      message: { type: "text"; text: string };
    }
  | any;

const VERSION = "v2.9.0-slots-list";

// ---------- HTTPエンドポイント ----------
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Healthcheck
    if (url.pathname === "/__ping") return new Response("ok", { status: 200 });

    // 受信（LINE Webhook）
    if (request.method === "POST") {
      const body = await request.json<any>().catch(() => null);
      if (!body?.events?.length) return new Response("no events", { status: 200 });

      for (const ev of body.events as LineEvent[]) {
        try {
          if (ev.type === "message" && ev.message?.type === "text") {
            await onTextMessage(ev, env);
          }
        } catch (e: any) {
          console.error(e);
          if ("replyToken" in ev) {
            await replyText(env, ev.replyToken, `⚠️ エラー: ${e?.message ?? e}`);
          }
        }
      }
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ---------- メッセージ処理 ----------
async function onTextMessage(ev: LineEvent, env: Env) {
  const text = sanitize(ev.message.text);
  const replyToken = ev.replyToken;
  const userId = ev.source?.userId ?? "unknown";

  // 共通：簡易トークン化
  const [cmd, ...rest] = text.split(/\s+/);

  // ヘルプ
  if (cmd === "/help" || cmd === "ヘルプ") {
    await replyText(
      env,
      replyToken,
      [
        "使い方チートシート ✂️",
        "・予約: /reserve 9/25 15:00 カット",
        "・確認: /my",
        "・キャンセル: /cancel <ID>",
        "・枠表示: /slots 2025-09-25",
        "・枠設定: /set-slots 2025-09-25 10:00,11:30,14:00,16:30",
        `・バージョン: /version  → ${VERSION}`,
      ].join("\n")
    );
    return;
  }

  // バージョン
  if (cmd === "/version") {
    await replyText(env, replyToken, `API: ${VERSION}`);
    return;
  }

  // お掃除（鍵のない予約ロック等を削除）
  if (cmd === "/cleanup") {
    let removed = 0;
    const iter = env.LINE_BOOKING.list({ prefix: "lock:" });
    for await (const { name } of iter) {
      await env.LINE_BOOKING.delete(name);
      removed++;
    }
    await replyText(env, replyToken, `🧹 お掃除完了！\n削除: ${removed} 件`);
    return;
  }

  // スロット設定（管理コマンド）
  if (cmd === "/set-slots") {
    const date = rest[0];
    const list = (rest[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
    if (!date || list.length === 0) {
      await replyText(env, replyToken, "使い方: /set-slots 2025-09-25 10:00,11:30,14:00,16:30");
      return;
    }
    await env.LINE_BOOKING.put(`slots:${date}`, JSON.stringify(list));
    await replyText(env, replyToken, `✅ ${date} の枠を更新したよ。\n${list.join(", ")}`);
    return;
  }

  // スロット一覧（★今回の修正版）
  if (cmd === "/slots") {
    const dateRaw = rest[0];
    if (!dateRaw) {
      await replyText(env, replyToken, "使い方: /slots 2025-09-25");
      return;
    }
    const date = normalizeDate(dateRaw);
    const slotsRaw = await env.LINE_BOOKING.get(`slots:${date}`);
    if (!slotsRaw) {
      await replyText(env, replyToken, `⚠️ ${date} の枠はまだ登録されてないよ。\n/set-slots で追加してね。`);
      return;
    }
    const slots: string[] = JSON.parse(slotsRaw);
    let out = `📅 ${date} の空き状況\n`;
    for (const t of slots) {
      const taken = await env.LINE_BOOKING.get(`taken:${date}T${t}`);
      out += taken ? `❌ ${t}（埋まり）\n` : `🟢 ${t}（空き）\n`;
    }
    await replyText(env, replyToken, out.trimEnd());
    return;
  }

  // 予約
  if (cmd === "/reserve") {
    // 例: /reserve 9/25 15:00 カット
    const [dRaw, time, ...titleArr] = rest;
    if (!dRaw || !time) {
      await replyText(env, replyToken, "使い方: /reserve 9/25 15:00 カット");
      return;
    }
    const date = normalizeDate(dRaw);
    const title = titleArr.join(" ") || "カット";

    // 二重予約判定
    const lockKey = `lock:${userId}:${date}T${time}`;
    const lock = await env.LINE_BOOKING.get(lockKey);
    if (lock) {
      await replyText(env, replyToken, "⚠️ その操作はすでに進行中だよ。少し待ってね。");
      return;
    }
    await env.LINE_BOOKING.put(lockKey, "1", { expirationTtl: 30 });

    try {
      // その時間が有効枠に含まれているか？
      const slotsRaw = await env.LINE_BOOKING.get(`slots:${date}`);
      if (!slotsRaw) throw new Error("その日の枠が未登録だよ。/set-slots で設定してね。");
      const slots: string[] = JSON.parse(slotsRaw);
      if (!slots.includes(time)) throw new Error("その時間は枠にありません。/slots で確認してね。");

      // 既に埋まっている？
      const takenKey = `taken:${date}T${time}`;
      const taken = await env.LINE_BOOKING.get(takenKey);
      if (taken) throw new Error("⚠️ その日時は既に予約があります。別の時間でお願い🙏");

      // 予約ID（短縮）
      const id = shortId(`${userId}:${date}T${time}:${title}`);
      const rKey = `resv:${userId}:${id}`;

      await env.LINE_BOOKING.put(rKey, JSON.stringify({ userId, id, date, time, title }), {
        expirationTtl: 60 * 60 * 24 * 30, // 30日
      });
      await env.LINE_BOOKING.put(takenKey, rKey, { expirationTtl: 60 * 60 * 24 * 30 });

      await replyText(
        env,
        replyToken,
        [
          "✅ 予約を保存したよ！",
          `ID: ${id}`,
          `日時: ${date} ${time}`,
          `内容: ${title}`,
          "",
          "確認は /my、キャンセルは `/cancel <ID>`",
        ].join("\n")
      );
    } finally {
      await env.LINE_BOOKING.delete(lockKey);
    }
    return;
  }

  // キャンセル
  if (cmd === "/cancel") {
    const id = rest[0];
    if (!id) {
      await replyText(env, replyToken, "使い方: /cancel <ID>");
      return;
    }
    const rKey = `resv:${userId}:${id}`;
    const data = await env.LINE_BOOKING.get(rKey);
    if (!data) {
      await replyText(env, replyToken, `ID ${id} の予約が見つからないよ🥲`);
      return;
    }
    const r = JSON.parse(data) as { date: string; time: string };
    await env.LINE_BOOKING.delete(rKey);
    await env.LINE_BOOKING.delete(`taken:${r.date}T${r.time}`);
    await replyText(
      env,
      replyToken,
      ["✅ キャンセル完了！", `ID: ${id}`, `日時: ${r.date} ${r.time}`].join("\n")
    );
    return;
  }

  // 自分の予約
  if (cmd === "/my") {
    const list = await collectUserReservations(env, userId);
    if (list.length === 0) {
      await replyText(env, replyToken, "いま有効な予約はないよ💤");
      return;
    }
    const lines = ["🧾 あなたの予約（最新10件）"];
    for (const r of list.slice(0, 10)) {
      lines.push(`🟢 ${r.id}  ${r.date} ${r.time}  ${r.title}`);
    }
    lines.push("", "キャンセルは `/cancel <ID>`");
    await replyText(env, replyToken, lines.join("\n"));
    return;
  }

  // デバッグ
  if (cmd === "/debug") {
    await replyText(env, replyToken, `RAW: ${text}\nNORM: ${sanitize(text)}`);
    return;
  }

  // フォールバック（エコー）
  await replyText(env, replyToken, `echo: ${text}`);
}

// ---------- 予約一覧の収集 ----------
async function collectUserReservations(env: Env, userId: string) {
  const prefix = `resv:${userId}:`;
  const out: { id: string; date: string; time: string; title: string }[] = [];
  const itr = env.LINE_BOOKING.list({ prefix });
  for await (const { name } of itr) {
    const data = await env.LINE_BOOKING.get(name);
    if (!data) continue;
    const r = JSON.parse(data);
    out.push({ id: r.id, date: r.date, time: r.time, title: r.title ?? "予約" });
  }
  // 新しい順(適当ソート：date+time降順)
  out.sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));
  return out;
}

// ---------- ユーティリティ ----------
function sanitize(s: string) {
  return s.replace(/\u3000/g, " ").trim(); // 全角スペース→半角
}

function shortId(s: string) {
  // 簡易ハッシュ → 6桁
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return (h.toString(16).padStart(8, "0")).slice(-6);
}

function normalizeDate(input: string) {
  // "9/25" → "2025-09-25"（今年または来年判定でもOK、ここでは2025固定にせず、年がなければ西暦推測）
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const m = input.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m) {
    const now = new Date();
    let y = now.getFullYear();
    const mm = Number(m[1]);
    const dd = Number(m[2]);
    // もし今日よりかなり過去なら翌年に寄せる（簡易）
    const candidate = new Date(y, mm - 1, dd);
    if (candidate.getTime() < now.getTime() - 1000 * 60 * 60 * 24 * 7) y++;
    return `${y}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
  }
  return input; // 既に正規ならそのまま
}

async function replyText(env: Env, replyToken: string, text: string) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    console.error("LINE reply error:", res.status, t);
  }
}
