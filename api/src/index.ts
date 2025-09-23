// api/src/index.ts
export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_CHANNEL_ACCESS_TOKEN: string;
  LINE_CHANNEL_SECRET: string;
  TZ?: string; // default Asia/Tokyo
}

/* =========================
 * Worker entry
 * ========================= */
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/__ping") return new Response("ok");

    if (url.pathname === "/api/line/webhook" && req.method === "POST") {
      const raw = await req.text();

      // verify LINE signature
      const ok = await verifyLineSignature(
        raw,
        req.headers.get("x-line-signature") || "",
        env.LINE_CHANNEL_SECRET
      );
      if (!ok) return new Response("invalid signature", { status: 401 });

      const payload = JSON.parse(raw);
      for (const ev of payload.events ?? []) {
        if (ev.type === "message" && ev.message?.type === "text" && ev.replyToken) {
          const userId = ev.source?.userId as string | undefined;
          if (!userId) continue;

          try {
            const msg = await handleCommand(ev.message.text ?? "", userId, env);
            await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, ev.replyToken, msg);
          } catch (e: any) {
            await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, ev.replyToken, {
              type: "text",
              text: `⚠️ エラー: ${e?.message ?? "不明なエラー"}`,
            });
          }
        } else if (ev.type === "follow" && ev.replyToken) {
          await lineReply(env.LINE_CHANNEL_ACCESS_TOKEN, ev.replyToken, {
            type: "text",
            text:
              "フォローありがとう💚\n" +
              "予約は `/reserve 9/25 15:00 カット`\n" +
              "空き枠は `/slots 9/25`\n" +
              "一覧は `/my`、キャンセルは `/cancel <ID>`",
          });
        }
      }
      return new Response("ok");
    }

    return new Response("Not Found", { status: 404 });
  },
};

/* =========================
 * Command router
 * ========================= */
async function handleCommand(text: string, userId: string, env: Env): Promise<LineMessage> {
  const first = (text ?? "").split(/\r?\n/)[0];
  const cleaned = stripInvisibles(first).normalize("NFKC");

  // /debug … : 文字状態の診断
  if (/^[\\\/／]\s*debug\b/i.test(cleaned)) {
    const hex = [...first].map(c => c.codePointAt(0)!.toString(16).padStart(4,"0")).join(" ");
    const norm = stripLeadingGarbage(cleaned);
    return { type: "text", text: `RAW: ${first}\nHEX: ${hex}\nNORM: ${norm}` };
  }

  // 正規化＆先頭ゴミ除去
  const canon = stripLeadingGarbage(cleaned);

  // ★ 文中の最初の /cmd を拾う（後ろに引数があってもOK）
  const mCmd = canon.match(/[\\\/／]\s*(reserve|my|cancel|cleanup|slots|set-slots)\b/i);
  const cmd = mCmd ? mCmd[1].toLowerCase() : "";

  /* ---------- /slots ---------- */
  if (cmd === "slots") {
    // 例) /slots 9/25  or /slots 2025-09-25
    const arg = canon.replace(/[\\\/／]\s*slots\b/i, "").trim();
    const p = parseDateOnly(arg);
    if (!p.ok) return { type: "text", text: "使い方: `/slots 9/25` または `/slots 2025-09-25`" };
    const dateStr = `${p.value.y}-${pad(p.value.m)}-${pad(p.value.d)}`;

    const allSlots = await getSlots(env, dateStr);
    const reservations = await listReservationsByDate(env, userId, dateStr);
    const bookedTimes = new Set(reservations.filter(r => r.status === "booked").map(r => r.time));

    const available = allSlots.filter(t => !bookedTimes.has(t));
    return buildSlotsFlex(dateStr, available, "カット");
  }

  /* ---------- /set-slots ---------- */
  if (cmd === "set-slots") {
    // 例) /set-slots 2025-09-25 10:00,11:30,14:00,16:30
    const m = canon.match(/[\\\/／]\s*set-slots\s+(\d{4}-\d{2}-\d{2})\s+([0-2]?\d:[0-5]\d(?:\s*,\s*[0-2]?\d:[0-5]\d)*)/i);
    if (!m) return { type: "text", text: "使い方: `/set-slots 2025-09-25 10:00,11:30,14:00`" };
    const dateStr = m[1];
    const arr = m[2].split(",").map(s => s.trim());
    await env.LINE_BOOKING.put(slotsKey(dateStr), JSON.stringify(arr));
    return { type: "text", text: `✅ ${dateStr} の枠を更新したよ。\n${arr.join(", ")}`, quickReply: quick([`/slots ${dateStr}`]) };
  }

  /* ---------- /reserve ---------- */
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
    const dateStr = `${year}-${pad(month)}-${pad(day)}`;
    const iso = toISOJST(year, month, day, time);

    // 重複チェック（同一 iso の予約があるか）
    const conflict = await findConflict(env, userId, iso);
    if (conflict) {
      return {
        type: "text",
        text:
          "⚠️ その日時は既に予約があります。\n" +
          `ID: ${conflict.id}\n日時: ${conflict.date} ${conflict.time}\n内容: ${conflict.service}\n\n` +
          "別の時間で予約してね🙏",
        quickReply: quick(["/my", `/cancel ${conflict.id}`, `/slots ${dateStr}`]),
      };
    }

    // 保存
    const id = await deterministicId(`${userId}|${iso}`);
    const nowIso = nowISOJST();
    const rec: Reservation = {
      id,
      userId,
      service,
      iso,
      date: dateStr,
      time,
      status: "booked",
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    await saveReservation(env, rec);

    return {
      type: "text",
      text:
        `✅ 予約を保存したよ！\n` +
        `ID: ${rec.id}\n日時: ${rec.date} ${rec.time}\n内容: ${rec.service}\n\n` +
        `確認は /my、キャンセルは \`/cancel ${rec.id}\``,
      quickReply: quick(["/my", `/cancel ${rec.id}`, `/slots ${rec.date}`]),
    };
  }

  /* ---------- /my ---------- */
  if (cmd === "my") {
    const list = await listReservations(env, userId, 10);
    if (!list.length) {
      return {
        type: "text",
        text: "まだ予約はないみたい👀\n`/reserve 9/25 15:00 カット` のように予約してみて！",
        quickReply: quick(["/reserve 9/25 15:00 カット", "/slots 9/25"]),
      };
    }
    const lines = list
      .map(r => `${r.status === "canceled" ? "❌" : "🟢"} ${r.id}  ${r.date} ${r.time}  ${r.service}`)
      .join("\n");
    return { type: "text", text: `📒 あなたの予約（最新10件）\n${lines}\n\nキャンセルは \`/cancel <ID>\`` };
  }

  /* ---------- /cancel ---------- */
  if (cmd === "cancel") {
    const mid = canon.match(/([a-f0-9]{8})/i);
    if (!mid) return { type: "text", text: "キャンセルする予約IDを指定してね 👉 `/cancel abc12345`" };
    const id = mid[1].toLowerCase();

    const rec = await getReservation(env, userId, id);
    if (!rec) return { type: "text", text: `ID ${id} の予約が見つからないよ😢` };
    if (rec.status === "canceled") return { type: "text", text: `ID ${id} はすでにキャンセル済みだよ👌` };

    rec.status = "canceled";
    rec.updatedAt = nowISOJST();
    await saveReservation(env, rec);

    return {
      type: "text",
      text: `🧹 キャンセル完了！\nID: ${id}\n${rec.date} ${rec.time}  ${rec.service}`,
      quickReply: quick(["/my", `/slots ${rec.date}`]),
    };
  }

  /* ---------- /cleanup ---------- */
  if (cmd === "cleanup") {
    const { kept, canceled, remaining } = await cleanupDuplicates(env, userId, 40);
    const more = remaining > 0 ? `\n（まだ ${remaining} 件あるので、もう一度 /cleanup を実行してね）` : "";
    return {
      type: "text",
      text: `🧽 お掃除完了！\n保持: ${kept} 件\n自動キャンセル: ${canceled.length} 件${more}`,
      quickReply: quick(["/my"]),
    };
  }

  // default help
  return {
    type: "text",
    text: "予約するなら `/reserve 9/25 15:00 カット`、空き枠は `/slots 9/25` だよ💇‍♀️",
    quickReply: quick(["/slots 9/25", "/my"]),
  };
}

/* =========================
 * LINE helpers
 * ========================= */
type LineMessage =
  | { type: "text"; text: string; quickReply?: any }
  | { type: "flex"; altText: string; contents: any; quickReply?: any };

async function lineReply(token: string, replyToken: string, message: LineMessage) {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ replyToken, messages: [message] }),
  });
  if (!res.ok) throw new Error(`LINE Reply Error: ${res.status} ${await res.text()}`);
}

async function verifyLineSignature(body: string, signature: string, secret: string): Promise<boolean> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const base64 = btoa(String.fromCharCode(...new Uint8Array(sig)));
  return base64 === signature;
}

/* =========================
 * Domain / KV
 * ========================= */
type ReservationStatus = "booked" | "canceled";
interface Reservation {
  id: string; // 8-hex
  userId: string;
  service: string;
  iso: string;  // 2025-09-25T15:00:00+09:00
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: ReservationStatus;
  createdAt: string;
  updatedAt: string;
}

function resvKey(userId: string, id: string) { return `resv:${userId}:${id}`; }
function idxKey(userId: string) { return `idx:${userId}`; }
function slotsKey(dateStr: string) { return `slots:${dateStr}`; }

async function saveReservation(env: Env, r: Reservation) {
  await env.LINE_BOOKING.put(resvKey(r.userId, r.id), JSON.stringify(r));
  const ids = ((await env.LINE_BOOKING.get(idxKey(r.userId), "json")) as string[] | null) ?? [];
  const next = [r.id, ...ids.filter(x => x !== r.id)].slice(0, 100);
  await env.LINE_BOOKING.put(idxKey(r.userId), JSON.stringify(next));
}
async function getReservation(env: Env, userId: string, id: string) {
  return (await env.LINE_BOOKING.get(resvKey(userId, id), "json")) as Reservation | null;
}
async function listReservations(env: Env, userId: string, limit = 10) {
  const ids = ((await env.LINE_BOOKING.get(idxKey(userId), "json")) as string[] | null) ?? [];
  const out: Reservation[] = [];
  for (const id of ids.slice(0, limit)) {
    const r = await getReservation(env, userId, id);
    if (r) out.push(r);
  }
  return out;
}
async function listReservationsByDate(env: Env, userId: string, dateStr: string) {
  const ids = ((await env.LINE_BOOKING.get(idxKey(userId), "json")) as string[] | null) ?? [];
  const out: Reservation[] = [];
  for (const id of ids) {
    const r = await getReservation(env, userId, id);
    if (r && r.date === dateStr) out.push(r);
  }
  return out;
}
async function getSlots(env: Env, dateStr: string): Promise<string[]> {
  const v = await env.LINE_BOOKING.get(slotsKey(dateStr), "json");
  if (Array.isArray(v)) return v as string[];
  return ["10:00", "13:00", "15:00"]; // デフォルト
}

async function findConflict(env: Env, userId: string, iso: string): Promise<Reservation | null> {
  const ids = ((await env.LINE_BOOKING.get(idxKey(userId), "json")) as string[] | null) ?? [];
  for (const id of ids) {
    const r = await getReservation(env, userId, id);
    if (r && r.status === "booked" && r.iso === iso) return r;
  }
  return null;
}

async function cleanupDuplicates(env: Env, userId: string, maxScan = 40) {
  const ids = ((await env.LINE_BOOKING.get(idxKey(userId), "json")) as string[] | null) ?? [];
  const scan = ids.slice(0, maxScan);
  const seen = new Map<string, Reservation[]>();
  for (const id of scan) {
    const r = await getReservation(env, userId, id);
    if (!r) continue;
    const g = seen.get(r.iso) ?? [];
    g.push(r); seen.set(r.iso, g);
  }
  const canceled: string[] = [];
  let kept = 0;
  for (const [, group] of seen) {
    const booked = group.filter(g => g.status === "booked")
                        .sort((a,b)=> (a.updatedAt > b.updatedAt ? -1 : 1));
    if (!booked.length) continue;
    const [keep, ...dups] = booked;
    kept++;
    for (const d of dups) {
      d.status = "canceled";
      d.updatedAt = nowISOJST();
      await saveReservation(env, d);
      canceled.push(d.id);
    }
  }
  return { kept, canceled, remaining: Math.max(ids.length - scan.length, 0) };
}

/* =========================
 * Utils
 * ========================= */
function stripInvisibles(s: string) {
  return s.replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF\u00AD\u00A0]/g, "");
}
function stripLeadingGarbage(s: string) {
  return s.trim().replace(/^[^\p{L}\p{N}\/\\]+/u, "").replace(/^[\\／]/, "/");
}
function pad(n: number) { return n.toString().padStart(2, "0"); }

function todayJST(): Date { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function nowISOJST(): string { return toISOOffset(new Date(), 9*60); }
function toISOJST(y: number, m: number, d: number, hhmm: string) {
  const [H,M] = hhmm.split(":").map(v=>parseInt(v,10));
  return `${y}-${pad(m)}-${pad(d)}T${pad(H)}:${pad(M)}:00+09:00`;
}
function toISOOffset(d: Date, offsetMin: number) {
  const t = new Date(d.getTime() + offsetMin*60*1000);
  const yyyy = t.getUTCFullYear();
  const mm = pad(t.getUTCMonth()+1);
  const dd = pad(t.getUTCDate());
  const HH = pad(t.getUTCHours());
  const MM = pad(t.getUTCMinutes());
  const SS = pad(t.getUTCSeconds());
  const sign = offsetMin >= 0 ? "+" : "-";
  const off = Math.abs(offsetMin);
  const oh = pad(Math.floor(off/60));
  const om = pad(off%60);
  return `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}${sign}${oh}:${om}`;
}

async function deterministicId(s: string) {
  const buf = new TextEncoder().encode(s);
  const dig = await crypto.subtle.digest("SHA-1", buf);
  return Array.from(new Uint8Array(dig).slice(0,4), b=>b.toString(16).padStart(2,"0")).join("");
}

function parseReserveCommand(s: string):
  | { ok: true; value: { year: number; month: number; day: number; time: string; service: string } }
  | { ok: false } {
  const m = s.match(/\/\s*reserve\s+([0-9]{1,4}[\/-][0-9]{1,2}(?:[\/-][0-9]{1,2})?)\s+([0-2]?\d:[0-5]\d)\s+(.+)/i);
  if (!m) return { ok: false };
  const dateRaw = m[1].replace(/-/g,"/").replace(/\./g,"/");
  const time = m[2];
  const service = m[3].trim();

  const parts = dateRaw.split("/");
  let y: number, mo: number, d: number;
  if (parts.length === 2) {
    const t = todayJST();
    y = t.getFullYear();
    mo = parseInt(parts[0],10);
    d = parseInt(parts[1],10);
  } else if (parts.length === 3) {
    y = parseInt(parts[0],10);
    mo = parseInt(parts[1],10);
    d = parseInt(parts[2],10);
  } else return { ok: false };

  return { ok: true, value: { year: y, month: mo, day: d, time, service } };
}

function parseDateOnly(arg: string):
  | { ok: true; value: { y: number; m: number; d: number } }
  | { ok: false } {
  const s = arg.trim();
  if (!s) {
    const t = todayJST();
    return { ok: true, value: { y: t.getFullYear(), m: t.getMonth()+1, d: t.getDate() } };
  }
  if (/^\d{1,2}\/\d{1,2}$/.test(s)) {
    const t = todayJST();
    const [mm,dd] = s.split("/").map(x=>parseInt(x,10));
    return { ok: true, value: { y: t.getFullYear(), m: mm, d: dd } };
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const [y,mm,dd] = s.split("-").map(x=>parseInt(x,10));
    return { ok: true, value: { y, m: mm, d: dd } };
  }
  return { ok: false };
}

/* =========================
 * Flex builders
 * ========================= */
function buildSlotsFlex(dateStr: string, times: string[], service: string): LineMessage {
  const [y,m,d] = dateStr.split("-").map(n=>parseInt(n,10));
  const md = `${m}/${d}`;
  const buttons = (times.length ? times : ["(空きなし)"]).slice(0,12).map(t => {
    if (t === "(空きなし)") {
      return { type: "button", style: "secondary", action: { type: "message", label: t, text: "/my" }, height: "sm" };
    }
    return {
      type: "button",
      style: "primary",
      action: { type: "message", label: t, text: `/reserve ${md} ${t} ${service}` },
      height: "sm",
    };
  });

  const bubble = {
    type: "bubble",
    size: "mega",
    body: {
      type: "box",
      layout: "vertical",
      spacing: "md",
      contents: [
        { type: "text", text: "空き枠", weight: "bold", size: "xl" },
        { type: "text", text: dateStr, size: "sm", color: "#888" },
        { type: "separator", margin: "sm" },
        { type: "box", layout: "vertical", spacing: "sm", margin: "md", contents: buttons },
        { type: "text", text: "※ ボタンで予約メッセが自動入力", size: "xs", color: "#999", margin: "lg" },
      ],
    },
    footer: {
      type: "box",
      layout: "horizontal",
      contents: [
        { type: "button", style: "secondary", action: { type: "message", label: "マイ予約", text: "/my" } },
        { type: "button", style: "secondary", action: { type: "message", label: "他の日", text: "/slots 9/25" } },
      ],
    },
  };

  return { type: "flex", altText: `空き枠 ${dateStr}`, contents: bubble, quickReply: quick(["/my"]) };
}

function quick(labels: string[]) {
  return { items: labels.map(l => ({ type: "action", action: { type: "message", label: l.slice(0,20), text: l } })) };
}
