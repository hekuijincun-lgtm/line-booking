import { z } from "zod";
import { notifyLine, buildBookingConfirmationMessage } from "./lib/line-notify";

export interface Env {
  LINE_BOOKING: KVNamespace;
  LINE_MESSAGING_ACCESS_TOKEN: string;
}

// yyyy-MM-dd 形式
const qDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// JSTの「今日」を yyyy-MM-dd で返す
function getTodayJstDate(): string {
  const now = new Date();
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000); // UTC → JST(+9h)
  const y = jst.getFullYear();
  const m = (jst.getMonth() + 1).toString().padStart(2, "0");
  const d = jst.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 共通JSONレスポンス（CORS付き）
function json(body: any, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type,Authorization",
      ...extra,
    },
  });
}

// HH:mm〜HH:mm の表示ラベル
function formatJstLabel(isoStart: string, isoEnd: string): string {
  const toJst = (iso: string) => {
    const d = new Date(iso);
    const j = new Date(d.getTime() + 9 * 60 * 60 * 1000); // UTC → JST(+9h)
    const hh = j.getHours().toString().padStart(2, "0");
    const mm = j.getMinutes().toString().padStart(2, "0");
    return `${hh}:${mm}`;
  };
  return `${toJst(isoStart)}〜${toJst(isoEnd)}`;
}

export async function tryHandleBookingUiREST(
  request: Request,
  env: Env,
): Promise<Response | undefined> {
  const url = new URL(request.url);

  // --- OPTIONS -------------------------------------------------------------
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
    });
  }

  // --- GET /line/slots -----------------------------------------------------
  if (request.method === "GET" && url.pathname === "/line/slots") {
    let date = url.searchParams.get("date") ?? "";
    if (!qDate.safeParse(date).success) {
      date = getTodayJstDate();
    }
    let slots: any[] | null = null;
    try {
      const raw = await env.LINE_BOOKING.get(`slots:${date}`, "json");
      if (raw && Array.isArray(raw)) slots = raw;
    } catch {}

    if (!slots) {
      const base = new Date(`${date}T00:00:00+09:00`).getTime();
      const mk = (h: number) => new Date(base + h * 3600_000).toISOString();
      slots = [
        { id: `S-${date}-1`, start: mk(10), end: mk(11), capacity: 1, remaining: 1 },
        { id: `S-${date}-2`, start: mk(12), end: mk(13), capacity: 1, remaining: 1 },
        { id: `S-${date}-3`, start: mk(15), end: mk(16), capacity: 1, remaining: 1 },
      ];
    }

    return json({
      date,
      slots: slots.map((s) => ({
        ...s,
        label: formatJstLabel(s.start, s.end),
      })),
    });
  }

  // --- POST /line/reserve --------------------------------------------------
  if (request.method === "POST" && url.pathname === "/line/reserve") {
    const ReserveSchema = z
      .object({
        slotId: z.string().min(1),
        menuId: z.string().optional(),
        source: z.string().optional(),
        name: z.string().min(1).optional(),
        phone: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      })
      .passthrough();

    const body = await request.json().catch(() => ({}));
    const parsed = ReserveSchema.safeParse(body);
    if (!parsed.success) {
      return json({ error: "bad body", issues: parsed.error.issues }, 400);
    }

    const data = parsed.data;

    const id = crypto.randomUUID();
    const rec = {
      id,
      slotId: data.slotId,
      menuId: data.menuId ?? null,
      source: data.source ?? "web-ui",
      name: data.name?.trim() || "お客様",
      phone: data.phone ?? null,
      note: data.note ?? null,
      createdAt: new Date().toISOString(),
      status: "reserved",
    };

    await env.LINE_BOOKING.put(`resv:${id}`, JSON.stringify(rec), {
      expirationTtl: 60 * 60 * 24 * 7,
    });

    // UI用レスポンスも即返す（ここは高速）
    return json({ ok: true, id, reservationId: id });
  }

  // --- POST /line/notify ---------------------------------------------------
  if (request.method === "POST" && url.pathname === "/line/notify") {
    try {
      const body = (await request.json()) as { reserveId?: string };
      const reserveId = body.reserveId;
      if (!reserveId) {
        return json({ ok: false, error: "reserveId required" }, 400);
      }

      // 予約レコードを取得
      const recStr = await env.LINE_BOOKING.get(`resv:${reserveId}`, "text");
      if (!recStr) {
        return json({ ok: false, error: "reservation not found" }, 404);
      }
      const rec = JSON.parse(recStr);

      // SLOT 情報を取得して日付時間を抽出
      const slotStr = await env.LINE_BOOKING.get(`slots:${rec.slotId.split("-")[1]}`, "json");
      let dateLabel = "";
      let timeLabel = "";
      if (Array.isArray(slotStr)) {
        const slot = slotStr.find((s: any) => s.id === rec.slotId);
        if (slot) {
          dateLabel = slot.start.slice(0, 10).replace(/-/g, "/"); // yyyy/MM/dd
          timeLabel = formatJstLabel(slot.start, slot.end);
        }
      }

      const safeName = rec.name || "お客様";
      const msg = buildBookingConfirmationMessage(safeName, dateLabel, timeLabel);

      await notifyLine(env, rec.userId ?? null, msg);

      return json({ ok: true });
    } catch (err) {
      console.error("lineNotify error", err);
      return json({ ok: false, error: String(err) }, 500);
    }
  }

  return undefined;
}
