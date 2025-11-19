import { z } from "zod";

export interface Env {
  LINE_BOOKING: KVNamespace;
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

  // --- CORS / OPTIONS ------------------------------------------------------
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
    // UI から date 指定がなければ「今日(JST)」を使う
    let date = url.searchParams.get("date") ?? "";
    if (!qDate.safeParse(date).success) {
      date = getTodayJstDate();
    }

    let slots: any[] | null = null;
    try {
      const raw = await env.LINE_BOOKING.get(`slots:${date}`, "json");
      if (raw && Array.isArray(raw)) {
        slots = raw as any[];
      }
    } catch {
      // KVエラー時はフォールバックに進む
    }

    // KVに無ければデモ用の枠を生成
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

    // ✅ label を追加して返す（UI側は label をそのまま表示）
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
    // UI からは { slotId, menuId, source } が飛んでくる想定
    // name / phone / note はオプション扱いにして、name が無い場合は「Web予約」にする
    const ReserveSchema = z
      .object({
        slotId: z.string().min(1),
        menuId: z.string().optional(),
        source: z.string().optional(),
        name: z.string().min(1).optional(),
        phone: z.string().optional().nullable(),
        note: z.string().optional().nullable(),
      })
      .passthrough(); // 将来フィールド追加されても落とさない

    const body = await request.json().catch(() => ({}));
    const parsed = ReserveSchema.safeParse(body);

    if (!parsed.success) {
      return json(
        { error: "bad body", issues: parsed.error.issues },
        400,
      );
    }

    const data = parsed.data;

    const id = crypto.randomUUID();
    const rec = {
      id,
      slotId: data.slotId,
      menuId: data.menuId ?? null,
      source: data.source ?? "web-ui",
      name:
        typeof data.name === "string" && data.name.trim().length > 0
          ? data.name.trim()
          : "Web予約",
      phone: data.phone ?? null,
      note: data.note ?? null,
      createdAt: new Date().toISOString(),
      status: "reserved",
    };

    await env.LINE_BOOKING.put(`resv:${id}`, JSON.stringify(rec), {
      expirationTtl: 60 * 60 * 24 * 7, // 7日で自動削除
    });

    // UI 側は reservationId / id のどちらでも拾えるようにしておく
    return json({ ok: true, id, reservationId: id });
  }

  // このハンドラの対象外
  return undefined;
}
