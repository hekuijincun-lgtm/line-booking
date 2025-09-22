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
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/__ping") return new Response("ok", { status: 200 });

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

      for (const ev of payload.events || []) {
        if (ev.type === "message" && ev.message?.type === "text") {
          const userId = ev.source?.userId as string | undefined;
          const text: string = ev.message.text ?? "";
          const replyToken: string | undefined = ev.replyToken;
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
            text:
              "フォローありがと💚\n" +
              "予約は `/reserve 9/25 15:00 カット` みたいに打ってね！\n" +
              "一覧は `/my`、キャンセルは `/cancel <ID>` ✨",
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
async function handleCommand(text: string, userId: string, env: Env): Promise<LineMessage> {
  // --- 正規化（ゼロ幅/全角/余分スペース対策）---
  const firstLine = (text ?? "").split(/\r?\n/)[0]; // 最初の1行だけ採用
  const cleaned = firstLine.replace(/[\u200B-\u200D\uFEFF]/g, ""); // ZW chars除去
  const normalized = cleaned.normalize("NFKC").trim().replace(/\s+/g, " "); // 全角→半角 等
  const lower = normalized.toLowerCase();

  // ここを見たい時は一時的に↓を開ける
  // console.log("RAW=", JSON.stringify(text), "NORM=", normalized);

  if (/^\/reserve\b/i.test(normalized)) {
    const parsed = parseReserveCommand(normalized);
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

  if (/^\/my\b/i.test(lower)) {
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
    return { type: "text", text: `📒 あなたの予約（最新10件）\n${lines}\n\nキャンセルは \`/cancel <ID>\`` };
  }

  if (/^\/cancel\b/i.test(lower)) {
    const m = normalized.split(/\s+/);
    if (m.length < 2) return { type: "text", text: "キャンセルする予約IDを指定してね 👉 `/cancel abc12345`" };
    const id = m[1];
    const r = await getReservation(env, userId, id);
    if (!r) return { type: "text", text: `ID ${id} の予約が見つからないよ😢` };
    if (r.status === "canceled") return { type: "text", text: `ID ${id} はすでにキャンセル済みだよ👌` };
    r.status = "canceled";
    r.updatedAt = nowISOJST();
    await saveReservation(env, r);
    return { type: "text", text: `🧹 キャンセル完了！\nID: ${id}\n${r.date} ${r.time}  ${r.service}`, quickReply: quick(["/my", "ヘルプ"]) };
  }

  if (["help", "/help", "ヘルプ"].some((k) => lower.startsWith(k))) {
    return {
      type: "text",
      text: "📚 コマンド一覧\n・予約: `/reserve 9/25 15:00 カット`\n・一覧: `/my`\n・取消: `/cancel <ID>`",
      quickReply: quick(["/reserve 9/25 15:00 カット", "/my"]),
    };
  }

  // 既定: 軽いヘルプ + エコー
  return {
    type: "text",
    text: "echo: " + normalized + "\n\n予約するなら `/reserve 9/25 15:00 カット` って打ってね💇‍♂️",
    quickReply: quick(["/reserve 9/25 15:00 カット", "/my", "ヘルプ"]),
  };
}

/* =========================
 * LINE Helpers
 * ========================= */
type LineMessage = { type: "text"; text: string; quickReply?: any } | any;

async function lineReply(token: string, replyToken: string, message: LineMessage) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
  if (!res.ok) throw new Error(`LINE Reply Error: ${res.status} ${await res.text()}`);
}

async function verifyLineSignature(bodyText: string, signature: string, channelSecret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(channelSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyText));
  const base64 = toBase64(new Uint8Array(sigBuf));
  return base64 === signature;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* =========================
 * Domain: Reservation
 * ========================= */
type ReservationStatus = "booked" | "canceled";
interface Reservation {
  id: string;
  userId: string;
  service: string;
  iso: string;   // 2025-09-25T15:00:00+09:00
  date: string;  // YYYY-MM-DD
  time: string;  // HH:mm
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

async function saveReservation(env: Env, r: Reservation) {
  const key = resvKey(r.userId, r.id);
  await env.LINE_BOOKING.put(key, JSON.stringify(r));
  const idxKey = idxKeyOf(r.userId);
  const current = (await env.LINE_BOOKING.get(idxKey, "json")) as string[] | null;
  const next = Array.isArray(current) ? current : [];
  if (!next.includes(r.id)) next.unshift(r.id);
  await env.LINE_BOOKING.put(idxKey, JSON.stringify(next.slice(0, 100)));
}

async function getReservation(env: Env, userId: string, id: string) {
  return (await env.LINE_BOOKING.get(resvKey(userId, id), "json")) as Reservation | null;
}

async function listReservations(env: Env, userId: string, limit = 10) {
  const ids = ((await env.LINE_BOOKING.get(idxKeyOf(userId), "json")) as string[] | null) || [];
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
  // 例: /reserve 9/25 15:00 カット  or  /reserve 2025-09-25 15:00 カット
  const m = text.match(/\/reserve\s+([0-9]{1,4}[\/-][0-9]{1,2}(?:[\/-][0-9]{1,2})?)\s+([0-2]?\d:[0-5]\d)\s+(.+)/i);
  if (!m) return { ok: false };

  const dateRaw = m[1].replace(/\./g, "/").replace(/-/g, "/");
  const time = m[2];
  const service = m[3].trim();

  const parts = dateRaw.split("/");
  let year: number, month: number, day: number;

  if (parts.length === 2) {
    const now = nowJST();
    year = now.getFullYear();
    month = parseInt(parts[0], 10);
    day = parseInt(parts[1], 10);
    const iso = toISOJST(year, month, day, time);
    if (new Date(iso) < now) year = year + 1; // 過去なら翌年へ
  } else if (parts.length === 3) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else return { ok: false };

  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };
  return { ok: true, value: { year, month, day, time, service } };
}

function nowJST(): Date {
  return new Date(Date.now() + 9 * 60 * 60 * 1000);
}
function nowISOJST(): string {
  return toISOOffset(nowJST());
}
function toISOJST(year: number, month: number, day: number, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map((v) => parseInt(v, 10));
  return `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00+09:00`;
}
function toISOOffset(d: Date, offsetMinutes = 540): string {
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
