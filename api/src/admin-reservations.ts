export type Reservation = {
  id: string;
  slotId: string;
  date: string;      // YYYY-MM-DD
  start: string;     // ISO
  end: string;       // ISO
  name: string;
  channel?: string;
  note?: string;
  createdAt: string; // ISO
};

// 1つのオブジェクトを Reservation にマッピング（ダメなら null）
function mapToReservation(source: any, keyName: string): Reservation | null {
  if (!source || typeof source !== "object") return null;

  const slotId: string =
    source.slotId ??
    source.slot_id ??
    source.slotID ??
    source.slot?.id ??
    "";

  const startIso: string =
    source.start ??
    source.startAt ??
    source.start_at ??
    source.from ??
    source.timeStart ??
    source.slot?.start ??
    "";

  const endIso: string =
    source.end ??
    source.endAt ??
    source.end_at ??
    source.to ??
    source.timeEnd ??
    source.slot?.end ??
    "";

  let date: string =
    source.date ??
    source.day ??
    source.dateStr ??
    source.bookingDate ??
    "";

  // start の ISO から YYYY-MM-DD を切り出す fallback
  if (!date && typeof startIso === "string" && startIso.length >= 10) {
    date = startIso.slice(0, 10);
  }

  const name: string =
    source.name ??
    source.customerName ??
    source.userName ??
    "";

  const channel: string | undefined =
    source.channel ??
    source.source ??
    undefined;

  const note: string | undefined =
    source.note ??
    source.memo ??
    source.message ??
    undefined;

  const createdAtRaw: string | undefined =
    source.createdAt ??
    source.created_at ??
    source.created ??
    startIso;

  const createdAt: string =
    typeof createdAtRaw === "string" && createdAtRaw.length > 0
      ? createdAtRaw
      : new Date().toISOString();

  // 必須がないやつは予約じゃないと見なしてスキップ
  if (!slotId || !date) {
    return null;
  }

  return {
    id: source.id ?? keyName,
    slotId,
    date,
    start: typeof startIso === "string" ? startIso : "",
    end: typeof endIso === "string" ? endIso : "",
    name,
    channel,
    note,
    createdAt,
  };
}

export async function handleAdminReservations(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);

  const qDate = url.searchParams.get("date"); // "2025-11-17"
  const qFrom = url.searchParams.get("from");
  const qTo   = url.searchParams.get("to");

  const kv = (env as any).LINE_BOOKING as KVNamespace;

  // ✅ prefix なしで全部 list
  const list = await kv.list();

  const reservations: Reservation[] = [];

  for (const key of list.keys) {
    const raw: any = await kv.get(key.name, "json");
    if (!raw || typeof raw !== "object") continue;

    // 生オブジェクト + よくありそうなネストを全部候補にする
    const candidates: any[] = [
      raw,
      raw.reservation,
      raw.data,
      raw.payload,
      raw.body,
    ];

    let pushed = false;

    for (const src of candidates) {
      if (!src || typeof src !== "object") continue;

      const r = mapToReservation(src, key.name);
      if (!r) continue;

      // ---- 日付フィルタ ---------------------------------------------
      if (qDate && r.date !== qDate) continue;
      if (qFrom && r.date < qFrom)   continue;
      if (qTo   && r.date > qTo)     continue;

      reservations.push(r);
      pushed = true;
      break; // 同じ KV キーから複数件は追加しない
    }

    // pushed されてなければ、そのキーは予約じゃなかった扱い
  }

  // 日付＋時間でソート
  reservations.sort((a, b) => {
    const ak = `${a.date}T${a.start}`;
    const bk = `${b.date}T${b.start}`;
    return ak.localeCompare(bk);
  });

  const body = JSON.stringify({ reservations }, null, 2);
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
