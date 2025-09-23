export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  TZ?: string; // default Asia/Tokyo
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/__ping") return new Response("ok", { status: 200 });

    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      const bodyText = await req.text();

      // LINE 署名検証
      if (
        !(await verifyLineSignature(
          bodyText,
          req.headers.get("x-line-signature") || "",
          env.LINE_CHANNEL_SECRET
        ))
      ) {
        return new Response("invalid signature", { status: 401 });
      }

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
              "予約は `/reserve 9/25 15:00 カット`\n" +
              "空き枠は `/slots 9/25`\n" +
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
  // 1行目だけ + 不可視削除 + 正規化
  const firstLineRaw = (text ?? "").split(/\r?\n/)[0];
  const removedInvis = firstLineRaw.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD\u00A0]/g, "");
  const normalized = removedInvis.normalize("NFKC").trim().replace(/\s+/g, " ");
  const stripped = normalized.replace(/^[^\p{L}\p{N}\/\\]+/u, "");
  const canon = stripped.replace(/^[\\／]/, "/");
  const lower = canon.toLowerCase();

  // /debug: 文字診断
  if (/^\/debug\b/.test(lower)) {
    const hex = [...firstLineRaw].map(c => c.codePointAt(0)!.toString(16).padStart(4,"0")).join(" ");
    return { type: "text", text: `RAW: ${firstLineRaw}\nHEX: ${hex}\nNORM: ${canon}` };
  }

  // /inspect: userId / iso / 決定論的ID / lock を表示
  if (/^\/inspect\b/.test(lower)) {
    const p = parseReserveCommand(canon.replace(/^\/\s*inspect\s+/i, "/reserve "));
    if (!p.ok) return { type: "text", text: "使い方: `/inspect 9/25 15:00 カット`" };
    const { year, month, day, time } = p.value;
    const iso = toISOJST(year, month, day, time);
    const id = await deterministicId(`${userId}|${iso}`);
    const lockKey = lockKeyOf(userId, iso);
    const locked = await env.LINE_BOOKING.get(lockKey);
    return { type: "text", text: `userId: ${userId}\niso: ${iso}\nid(deterministic): ${id}\nlock:${locked ?? "<none>"}` };
  }

  // コマンド判定
  const m = canon.match(/^\/\s*(reserve|my|cancel|cleanup|slots|set-slots)\b/i);
  const cmd = m?.[1]?.toLowerCase();

  /* ---- /slots ---- */
  if (cmd === "slots") {
    // /slots [date?] 例) /slots 9/25 or /slots 2025-09-25
    const p = parseDateOnly(canon.replace(/^\/\s*slots\s*/i, ""));
    if (!p.ok) {
      const today = todayJST();
      const d = { y: today.getFullYear(), m: today.getMonth()+1, d: today.getDate() };
      const dateStr = `${d.y}-${pad(d.m)}-${pad(d.d)}`;
      const defaults = await getSlots(env, dateStr);
      return buildSlotsFlex(dateStr, defaults, "カット");
    }
    const { y, m: mm, d } = p.value;
    const dateStr = `${y}-${pad(mm)}-${pad(d)}`;
    const slots = await getSlots(env, dateStr);
    return buildSlotsFlex(dateStr, slots, "カット");
  }

  /* ---- /set-slots ---- */
  if (cmd === "set-slots") {
    // 例) /set-slots 2025-09-25 10:00,11:30,14:00
    const m = canon.match(/\/\s*set-slots\s+([0-9]{4}-[0-9]{2}-[0-9]{2})\s+([0-2]?\d:[0-5]\d(?:\s*,\s*[0-2]?\d:[0-5]\d)*)/i);
    if (!m) return { type: "text", text: "使い方: `/set-slots 2025-09-25 10:00,11:30,14:00`" };
    const dateStr = m[1];
    const arr = m[2].split(",").map(s => s.trim());
    await env.LINE_BOOKING.put(slotsKey(dateStr), JSON.stringify(arr));
    return { type: "text", text: `✅ ${dateStr} の枠を更新したよ。\n${arr.join(", ")}`, quickReply: quick([`/slots ${dateStr}`]) };
  }

  /* ---- /reserve ---- */
  if (cmd === "reserve") {
    const parsed = parseReserveCommand(canon);
    if (!parsed.ok) {
      return {
        type: "text",
        text:
          "📝 予約コマンド例:\n`/reserve 9/25 15:00 カット`\n" +
          "・日付: M/D または YYYY-MM-DD\n・時間: HH:mm\n・サービス: 任意の文字列",
      };
    }

    const { year, month, day, time, service } = parsed.value;
    const iso = toISOJST(year, month, day, time);
    const id = await deterministicId(`${userId}|${iso}`);
    const lockKey = lockKeyOf(userId, iso);

    // 1) ロックでハードガード
    const locked = await env.LINE_BOOKING.get(lockKey);
    if (locked) {
      const existing = await getReservation(env, userId, locked);
      if (existing && existing.status === "booked") {
        return {
          type: "text",
          text:
            "⚠️ その日時は既に予約があります。\n" +
            `ID: ${existing.id}\n日時: ${existing.date} ${existing.time}\n内容: ${existing.service}\n\n` +
            "確認は /my、キャンセルは `/cancel <ID>`",
          quickReply: quick(["/my", `/cancel ${existing.id}`]),
        };
      }
    }

    // 2) ソフトガード
    const conflict = await findConflict(env, userId, iso);
    if (conflict) {
      await env.LINE_BOOKING.put(lockKey, conflict.id);
      return {
        type: "text",
        text:
          "⚠️ その日時は既に予約があります。\n" +
          `ID: ${conflict.id}\n日時: ${conflict.date} ${conflict.time}\n内容: ${conflict.service}\n\n` +
          "別の時間で予約してね🙏",
        quickReply: quick(["/my", `/cancel ${conflict.id}`]),
      };
    }

    // 3) 保存
    const nowIso = nowISOJST();
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
    await env.LINE_BOOKING.put(lockKey, id);

    // 確定カードはテキストで簡潔に（次フェーズでFlex化）
    return {
      type: "text",
      text:
        `✅ 予約を保存したよ！\n` +
        `ID: ${record.id}\n` +
        `日時: ${record.date} ${record.time}\n` +
        `内容: ${record.service}\n\n` +
        `確認は /my、キャンセルは \`/cancel ${record.id}\``,
      quickReply: quick(["/my", `/cancel ${record.id}`, `/slots ${record.date}`]),
    };
  }

  /* ---- /my ---- */
  if (cmd === "my") {
    const list = await listReservations(env, userId, 10);
    if (list.length === 0) {
      return {
        type: "text",
        text: "まだ予約はないみたい👀\n`/reserve 9/25 15:00 カット` のように予約してみて！",
        quickReply: quick(["/reserve 9/25 15:00 カット", "/slots 9/25", "ヘルプ"]),
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

  /* ---- /cancel ---- */
  if (cmd === "cancel") {
    const idMatch = canon.match(/([a-f0-9]{8})/i);
    if (!idMatch) return { type: "text", text: "キャンセルする予約IDを指定してね 👉 `/cancel abc12345`" };
    const id = idMatch[1].toLowerCase();

    const r = await getReservation(env, userId, id);
    if (!r) return { type: "text", text: `ID ${id} の予約が見つからないよ😢` };
    if (r.status === "canceled") return { type: "text", text: `ID ${id} はすでにキャンセル済みだよ👌` };

    r.status = "canceled";
    r.updatedAt = nowISOJST();
    await saveReservation(env, r);
    await env.LINE_BOOKING.delete(lockKeyOf(userId, r.iso)); // ロックも解除

    return {
      type: "text",
      text: `🧹 キャンセル完了！\nID: ${id}\n${r.date} ${r.time}  ${r.service}`,
      quickReply: quick(["/my", `/slots ${r.date}`, "ヘルプ"]),
    };
  }

  /* ---- /cleanup ---- */
  if (cmd === "cleanup") {
    const LIMIT = 40; // 分割実行で高速返信
    const { kept, canceled, remaining } = await cleanupDuplicates(env, userId, LIMIT);

    const lines = canceled.length ? `\nキャンセルID:\n- ${canceled.join("\n- ")}` : "";
    const more  = remaining > 0 ? `\n\n（まだ ${remaining} 件あるので、もう一度 /cleanup を実行してね）` : "";

    return {
      type: "text",
      text: `🧽 お掃除完了！\n処理: ${Math.min(LIMIT, kept + canceled.length)} 件\n自動キャンセル: ${canceled.length} 件${lines}${more}`,
      quickReply: quick(["/my", "/cleanup"]),
    };
  }

  // Default（軽いヘルプ）
  return {
    type: "text",
    text: `予約するなら \`/reserve 9/25 15:00 カット\`、空き枠は \`/slots 9/25\` だよ💇‍♂️`,
    quickReply: quick(["/reserve 9/25 15:00 カット", "/slots 9/25", "/my"]),
  };
}

/* =========================
 * LINE Helpers
 * ========================= */
type LineMessage =
  | { type: "text"; text: string; quickReply?: any }
  | { type: "flex"; altText: string; contents: any; quickReply?: any }
  ;

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
  let binary = ""; for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/* =========================
 * Domain: Reservation
 * ========================= */
type ReservationStatus = "booked" | "canceled";
interface Reservation {
  id: string;   // 8-hex (deterministic)
  userId: string;
  service: string;
  iso: string;  // 2025-09-25T15:00:00+09:00
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

/* ==== KV Keys ==== */
function resvKey(userId: string, id: string) { return `resv:${userId}:${id}`; }
function idxKeyOf(userId: string) { return `idx:${userId}`; }
function lockKeyOf(userId: string, iso: string) { return `dedup:${userId}:${iso}`; }
function slotsKey(dateStr: string) { return `slots:${dateStr}`; }

/* ==== CRUD ==== */
async function saveReservation(env: Env, r: Reservation) {
  await env.LINE_BOOKING.put(resvKey(r.userId, r.id), JSON.stringify(r));
  const idxKey = idxKeyOf(r.userId);
  const current = (await env.LINE_BOOKING.get(idxKey, "json")) as string[] | null;
  const next = Array.isArray(current) ? current : [];
  const filtered = next.filter(x => x !== r.id);
  filtered.unshift(r.id); // 最新先頭
  await env.LINE_BOOKING.put(idxKey, JSON.stringify(filtered.slice(0, 100)));
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

async function getSlots(env: Env, dateStr: string): Promise<string[]> {
  const v = await env.LINE_BOOKING.get(slotsKey(dateStr), "json");
  if (Array.isArray(v)) return v as string[];
  // デフォルト枠
  return ["10:00", "13:00", "15:00"];
}

/* ==== Duplicate helpers ==== */
async function findConflict(env: Env, userId: string, iso: string): Promise<Reservation | null> {
  const ids = ((await env.LINE_BOOKING.get(idxKeyOf(userId), "json")) as string[] | null) || [];
  for (const id of ids) {
    const r = (await env.LINE_BOOKING.get(resvKey(userId, id), "json")) as Reservation | null;
    if (r && r.status === "booked" && r.iso === iso) return r;
  }
  return null;
}

// 分割・高速版：同一 iso の複数予約を自動キャンセル（maxScan 件だけ見る）
async function cleanupDuplicates(
  env: Env,
  userId: string,
  maxScan = 40
): Promise<{ kept: number; canceled: string[]; remaining: number }> {
  const idxKey = idxKeyOf(userId);
  const ids = ((await env.LINE_BOOKING.get(idxKey, "json")) as string[] | null) || [];

  const scanIds = ids.slice(0, maxScan); // 新しい順
  const records: Reservation[] = [];
  for (const id of scanIds) {
    const r = (await env.LINE_BOOKING.get(resvKey(userId, id), "json")) as Reservation | null;
    if (r) records.push(r);
  }

  const byIso = new Map<string, Reservation[]>();
  for (const r of records) {
    const g = byIso.get(r.iso) ?? [];
    g.push(r);
    byIso.set(r.iso, g);
  }

  for (const [, group] of byIso) {
    group.sort((a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)); // 念のため新しい順に
  }

  const canceled: string[] = [];
  let keptCount = 0;

  for (const [, group] of byIso) {
    const booked = group.filter((g) => g.status === "booked");
    if (booked.length === 0) continue;

    const [keep, ...dups] = booked; // 最新1件だけ残す
    keptCount++;

    for (const d of dups) {
      d.status = "canceled";
      d.updatedAt = nowISOJST();
      await saveReservation(env, d);
      canceled.push(d.id);
    }

    await env.LINE_BOOKING.put(lockKeyOf(keep.userId, keep.iso), keep.id); // ロックを正に
  }

  // idx をユニーク化して保存（大規模再構築は避ける）
  const uniq = Array.from(new Set(ids));
  await env.LINE_BOOKING.put(idxKey, JSON.stringify(uniq.slice(0, 100)));

  const remaining = Math.max(ids.length - scanIds.length, 0);
  return { kept: keptCount, canceled, remaining };
}

/* ==== Deterministic ID ==== */
async function deterministicId(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-1", buf); // 20 bytes
  const view = new Uint8Array(digest).slice(0, 4);         // 8-hex
  return Array.from(view, b => b.toString(16).padStart(2, "0")).join("");
}

/* =========================
 * Parsing / Time utils
 * ========================= */
function parseReserveCommand(text: string):
  | { ok: true; value: { year: number; month: number; day: number; time: string; service: string } }
  | { ok: false } {
  // ex) /reserve 9/25 15:00 カット  or  /reserve 2025-09-25 15:00 カット
  const m = text.match(/\/\s*reserve\s+([0-9]{1,4}[\/-][0-9]{1,2}(?:[\/-][0-9]{1,2})?)\s+([0-2]?\d:[0-5]\d)\s+(.+)/i);
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
    if (new Date(toISOJST(year, month, day, time)) < now) year = year + 1; // 過去→翌年
  } else if (parts.length === 3) {
    year = parseInt(parts[0], 10);
    month = parseInt(parts[1], 10);
    day = parseInt(parts[2], 10);
  } else return { ok: false };

  if (month < 1 || month > 12 || day < 1 || day > 31) return { ok: false };
  return { ok: true, value: { year, month, day, time, service } };
}

function parseDateOnly(arg: string):
  | { ok: true; value: { y: number; m: number; d: number } }
  | { ok: false } {
  const s = arg.trim();
  if (!s) {
    const t = todayJST();
    return { ok: true, value: { y: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() } };
  }
  // 9/25 or 2025-09-25
  let y: number, m: number, d: number;
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const t = todayJST();
    y = t.getFullYear();
    m = parseInt(s.split("/")[0], 10);
    d = parseInt(s.split("/")[1], 10);
  } else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    [y, m, d] = s.split("-").map(x => parseInt(x, 10));
  } else return { ok: false };
  return { ok: true, value: { y, m, d } };
}

function todayJST(): Date { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function nowJST(): Date { return todayJST(); }
function nowISOJST(): string { return toISOOffset(nowJST()); }
function toISOJST(year: number, month: number, day: number, hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(v => parseInt(v, 10));
  return `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00+09:00`;
}
function toISOOffset(d: Date, offsetMinutes = 540): string {
  const t = new Date(d.getTime() - offsetMinutes * 60 * 1000);
  const y = t.getUTCFullYear(), m = pad(t.getUTCMonth() + 1), day = pad(t.getUTCDate());
  const hh = pad(t.getUTCHours()), mm = pad(t.getUTCMinutes()), ss = pad(t.getUTCSeconds());
  const sign = offsetMinutes >= 0 ? "+":"-"; const off = Math.abs(offsetMinutes);
  const oh = pad(Math.floor(off/60)), om = pad(off%60);
  return `${y}-${m}-${day}T${hh}:${mm}:${ss}${sign}${oh}:${om}`;
}
function pad(n: number) { return n.toString().padStart(2, "0"); }
function quick(labels: string[]) {
  return { items: labels.map(l => ({ type: "action", action: { type: "message", label: l.slice(0,20), text: l } })) };
}

/* =========================
 * Flex Message builders
 * ========================= */
function buildSlotsFlex(dateStr: string, times: string[], service: string): LineMessage {
  // ボタン1つ=メッセージアクション（reserve テンプレ）
  const [y, m, d] = dateStr.split("-").map(v => parseInt(v, 10));
  const md = `${m}/${d}`;
  const buttons = times.slice(0, 12).map((t) => ({
    type: "button",
    style: "primary",
    action: { type: "message", label: t, text: `/reserve ${md} ${t} ${service}` },
    height: "sm",
  }));

  const contents = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "空き枠", weight: "bold", size: "xl" },
        { type: "text", text: dateStr, size: "sm", color: "#888888" },
        { type: "separator", margin: "sm" },
        {
          type: "box",
          layout: "vertical",
          spacing: "sm",
          margin: "md",
          contents: buttons,
        },
        { type: "text", text: "※ タップで予約が作成されます", size: "xs", color: "#999999", margin: "lg" },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "button", style: "secondary", action: { type: "message", label: "他の日付", text: "/slots 9/25" } },
        { type: "button", style: "secondary", action: { type: "message", label: "マイ予約", text: "/my" } },
      ],
    },
  };

  return { type: "flex", altText: `空き枠 ${dateStr}`, contents, quickReply: quick(["/my"]) };
}
