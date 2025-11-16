import { z } from "zod";

export interface Env {
  LINE_BOOKING: KVNamespace;
}

const qDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

function json(body: any, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
      "Access-Control-Allow-Origin": "*",
      ...extra,
    },
  });
}

// ✅ JST で「HH:mm〜HH:mm」を作るラベル関数
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

  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization",
      },
    });
  }

  // --- GET /line/slots -----------------------------------------------------
  if (request.method === "GET" && url.pathname === "/line/slots") {
    const date = url.searchParams.get("date") ?? "";
    if (!qDate.safeParse(date).success) {
      return json({ error: "bad date" }, 400);
    }

    let slots: any[] | null = null;
    try {
      const raw = await env.LINE_BOOKING.get(`slots:${date}`, "json");
      if (raw && Array.isArray(raw)) {
        slots = raw as any[];
      }
    } catch {}

    if (!slots) {
      const base = new Date(`${date}T00:00:00+09:00`).getTime();
      const mk = (h: number) =>
        new Date(base + h * 3600_000).toISOString();

      slots = [
        {
          id: `S-${date}-1`,
          start: mk(10),
          end: mk(11),
          capacity: 1,
          remaining: 1,
        },
        {
          id: `S-${date}-2`,
          start: mk(12),
          end: mk(13),
          capacity: 1,
          remaining: 1,
        },
        {
          id: `S-${date}-3`,
          start: mk(15),
          end: mk(16),
          capacity: 1,
          remaining: 1,
        },
      ];
    }

    // ✅ label を追加して返す
    return json({
      slots: slots.map((s) => ({
        ...s,
        label: formatJstLabel(s.start, s.end),
      })),
    });
  }

  // --- POST /line/reserve --------------------------------------------------
  if (request.method === "POST" && url.pathname === "/line/reserve") {
    const ReserveSchema = z.object({
      slotId: z.string().min(1),
      name: z.string().min(1),
      phone: z.string().optional().nullable(),
      note: z.string().optional().nullable(),
    });

    const body = await request.json().catch(() => ({}));
    const parsed = ReserveSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        { error: "bad body", issues: parsed.error.issues },
        400,
      );
    }

    const id = crypto.randomUUID();
    const rec = {
      id,
      ...parsed.data,
      createdAt: new Date().toISOString(),
      status: "reserved",
    };

    await env.LINE_BOOKING.put(`resv:${id}`, JSON.stringify(rec), {
      expirationTtl: 60 * 60 * 24 * 7,
    });

    return json({ ok: true, id });
  }

  return undefined;
}