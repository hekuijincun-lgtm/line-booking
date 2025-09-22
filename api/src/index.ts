export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  TZ?: string; // default Asia/Tokyo
}

/**
 * ---- LINE Webhook エンドポイント ----
 * POST /api/line/webhook
 */
export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);

    // Healthcheck
    if (url.pathname === "/__ping") {
      return new Response("ok", { status: 200 });
    }

    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      const bodyText = await req.text();

      // 署名検証
      const isValid = await verifyLineSignature(
        bodyText,
        req.headers.get("x-line-signature") || "",
        env.LINE_CHANNEL_SECRET
      );
      if (!isValid) return new Response("invalid signature", { status: 401 });

      const payload = JSON.parse(bodyText);
      // 複数イベントに備えて順次処理
      for (const ev of payload.events || []) {
        if (ev.type === "message" && ev.message?.type === "text") {
          const userId = ev.source?.userId;
          const text: string = ev.message.text.trim();
          const replyToken: string = ev.replyToken;

          if (!userId || !replyToken) continue;

          try {
            const res = await handleCommand(text, userId, env);
            await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, res);
          } catch (e: any) {
            await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, replyToken, {
              type: "text",
              text: `⚠️ エラー: ${e?.message ?? "不明なエラー"}`,
            });
          }
        } else if (ev.type === "follow" && ev.replyToken) {
          await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, ev.replyToken, {
            type: "text",
            text: "フォローありがと💚\n予約は `/reserve 9/25 15:00 カット` みたいに打ってね！\n一覧は `/my`、キャンセルは `/cancel <ID>` ✨",
          });
        }
      }
      return new Response("ok", { status: 200 });
    }

    return new Response("Not Found", { status: 404 });
  },
};

/* =========================
 * Command Router
 * ========================= */
async function handleCommand(
  text: string,
  userId: string,
  env: Env
): Promise<LineMessage> {
  const lower = text.toLowerCase();

  if (lower.startsWith("/reserve")) {
    const parsed = parseReserveCommand(text);
    if (!parsed.ok) {
      return {
        type: "text",
        text:
          "📝 予約コマンド例:\n" +
          "`/reserve 9/25 15:00 カット`\n" +
          "・日付: M/D または YYYY-MM-DD\n" +
          "・時間: HH:mm\n" +
          "・サービス: 任意の文字列",
      };
    }

    const { year, month, day, time, service } = parsed.value;
    const iso = toISOJST(year, month, day, time);
    const nowIso = nowISOJST();

    // 予約IDを生成（短いID）
    const id = shortId();

    const record: Reservation = {
      id,
      userId,
      service,
      iso,
      date: `${year}-${pad(month)}-${pad(day)}`,
      time,
      status: "booked",
      createdAt: nowIso,
      updatedAt: nowIso,
    };

    await saveReservation(env, record);

    return {
      type: "text",
      text:
        `✅ 予約を保存したよ！\n` +
        `ID: ${id}\n` +
        `日時: ${record.date} ${record.time}\n` +
        `内容: ${record.service}\n\n` +
        `確認は /my、キャンセルは \`/cancel ${id}\``,
      quickReply: quick(["/my", `/cancel ${id}`, "ヘルプ"]),
    };
  }

  if (lower.startsWith("/my")) {
    const list = await listReservations(env, userId, 10);
    if (list.length === 0) {
      return {
        type: "text",
        text: "まだ予約はないみたい👀\n`/reserve 9/25 15:00 カット` のように予約してみて！",
        quickReply: quick(["/reserve 9/25 15:00 カット", "ヘルプ"]),
      };
    }
    const lines = list
      .map((r) => {
        const stat = r.status === "canceled" ? "❌" : "🟢";
        return `${stat} ${r.id}  ${r.date} ${r.time}  ${r.service}`;
      })
      .join("\n");
    return {
      type: "text",
      text: `📒 あなたの予約（最新10件）\n${lines}\n\nキャンセルは \`/cancel <ID>\``,
    };
  }

  if (lower.startsWith("/cancel")) {
    const m = text.trim().split(/\s+/);
    if (m.length < 2) {
      return {
        type: "text",
        text: "キャンセルする予約IDを指定してね 👉 `/cancel abc12345`",
      };
    }
    const id = m[1];
    const r = await getReservation(env, userId, id);
    if (!r) {
      return { type: "text", text: `ID ${id} の予約が見つからないよ😢` };
    }
    if (r.status === "canceled") {
      return { type: "text", text: `ID ${id} はすでにキャンセル済みだよ👌` };
    }
    r.status = "canceled";
    r.updatedAt = nowISOJST();
    await saveReservation(env, r);
    return {
      type: "text",
      text: `🧹 キャンセル完了！\nID: ${id}\n${r.date} ${r.time}  ${r.service}`,
      quickReply: quick(["/my", "ヘルプ"]),
    };
  }

  if (["help", "/help", "ヘルプ"].some((k) => lower.startsWith(k))) {
    return {
      type: "text",
      text:
        "📚 コマンド一覧\n" +
        "・予約: `/reserve 9/25 15:00 カット`\n" +
        "・一覧: `/my`\n" +
        "・取消: `/cancel <ID>`",
      quickReply: quick(["/reserve 9/25 15:00 カット", "/my"]),
    };
  }

  // 既定: 軽いヘルプ + エコー
  return {
    type: "text",
    text:
      "echo: " +
      text +
      "\n\n予約するなら `/reserve 9/25 15:00 カット` って打ってね💇‍♂️",
    quickReply: quick(["/reserve 9/25 15:00 カット", "/my", "ヘルプ"]),
  };
}

/* =========================
 * LINE Helpers
 * ========================= */
type LineMessage =
  | { type: "text"; text: string; quickReply?: any }
  | any; // 拡張余地（Flex 等）

async function lineReply(token: string, replyToken: string, message: LineMessage) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [message],
    }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LINE Reply Error: ${res.status} ${t}`);
  }
}

async function verifyLineSignature(
  bodyText: string,
  signature: string,
  channelSecret: string
): Promise<boolean> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(channelSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(bodyText)
  );
  const hash = btoa(String.fromCharCode(...new Uint8Array(sig)));
  // LINE は base64 なので一致比較
  return hash === signature;
}

/* =========================
 * Domain: Reservation
 * ========================= */
type ReservationStatus = "booked" | "canceled";
interface Reservation {
  id: string;
  userId: string;
  service: string;
  iso: string; // 2025-09-25T15:00:00+09:00
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

async function saveReservation(env: Env, r: Reservation) {
  const key = resvKey(r.userId, r.id);
  await env.LINE_BOOKING.put(key, JSON.stringify(r));
  // index 更新
  const idxKey = idxKeyOf(r.userId);
  const current = (await env.LINE_BOOKING.get(idxKey, "json")) as string[] | null;
  const next = Array.isArray(current) ? current : [];
  if (!next.includes(r.id)) next.unshift(r.id); // 新しいのを先頭へ
  // インデックスを最大100件程度に抑制（任意）
  await env.LINE_BOOKING.put(idxKey, JSON.stringify(next.slice(0, 100)));
}

async function getReservation(env: Env, userId: string, id: string) {
  const key = resvKey(userId, id);
  const json = await env.LINE_BOOKING.get(key, "json");
  return json as Reservation | null;
}

async function listReservations(env: Env, userId: string, limit = 10) {
  const idxKey = idxKeyOf(userId);
  const ids = ((await env.LINE_BOOKING.get(idxKey, "json")) as string[] | null) || [];
  const pick = ids.slice(0, limit);
  const results: Reservation[] = [];
  for (const id of pick) {
    const r = await getReservation(env, userId, id);
    if (r) results.push(r);
  }
  return results;
}

function resvKey(userId: string, id: string) {
  return `resv:${userId}:${id}`;
}
function idxKeyOf(userId: string) {
  return `idx:${userId}`;
}

/* =========================
 * Parsing / Time utils
 * ========================= */
function parseReserveCommand(text: string):
  | { ok: true; value: { year: number; month: number; day: number; time: string; service: string } }
  | { ok: false } {
  // 例: /reserve 9/25 15:00 カット
  const m = text.match(/\/reserve\s+([0-9]{1,4}[-\/][0-9]{1,2}[-\/]?[0-9]{1,2}?)\s+([0-2]?\d:[0-5]\d)\s+(.+)/i);
  if (!m) return { ok: false };

  const dateRaw = m[1].replace(/\./g, "/").replace(/-/g, "/");
  const time = m[2];
  const service = m[3].trim();

  // dateRaw: "9/25" or "2025/09/25"
  const parts = dateRaw.split("/");
  let year: number;
  let month: number;
  let day: number;

  if (parts.length === 2) {
    const now = nowJST();
    year = now.getFullYear();
    month = parseInt(parts[0]);
    day = parseInt(parts[1]);
    // 過去日付なら翌年にロール
    const iso = toISOJST(year, month, day, time);
    if (new Date(iso) < now) {
      year = year + 1;
    }
  } else if (parts.length === 3) {
    year = parseInt(parts[0]);
    month = parseInt(parts[1]);
    day = parseInt(parts[2]);
  } else {
    return { ok: false };
  }

  // 簡易バリデーション
  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };

  return { ok: true, value: { year, month, day, time, service } };
}

function nowJST(): Date {
  // Cloudflare は UTC。JST は +9h
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function nowISOJST(): string {
  const d = nowJST();
  return toISOOffset(d);
}
function toISOJST(year: number, month: number, day: number, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map((v) => parseInt(v));
  // ISO with +09:00 固定
  const date = `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00+09:00`;
  return date;
}
function toISOOffset(d: Date, offsetMinutes = 540 /* 9h */): string {
  const t = new Date(d.getTime() - offsetMinutes * 60 * 1000);
  const y = t.getUTCFullYear();
  const m = pad(t.getUTCMonth() + 1);
  const day = pad(t.getUTCDate());
  const hh = pad(t.getUTCHours());
  const mm = pad(t.getUTCMinutes());
  const ss = pad(t.getUTCSeconds());
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const off = Math.abs(offsetMinutes);
  const oh = pad(Math.floor(off / 60));
  const om = pad(off % 60);
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}
function pad(n: number) {
  return n.toString().padStart(2, "0");
}
function shortId(): string {
  // 8桁の簡易ID（衝突リスクは低いがゼロではない。必要に応じて強化してね）
  const arr = new Uint8Array(4);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, "0")).join("");
}
function quick(labels: string[]) {
  return {
    items: labels.map((l) => ({
      type: "action",
      action: { type: "message", label: l.slice(0, 20), text: l },
    })),
  };
}
