export async function handleAdminKvDump(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const prefix = url.searchParams.get("prefix") || ""; // 任意で prefix 絞り込み

  const kv = (env as any).LINE_BOOKING as KVNamespace;

  const list = await kv.list(prefix ? { prefix } : undefined);

  const items: any[] = [];

  for (const key of list.keys) {
    const value = await kv.get(key.name, "json");
    items.push({
      key: key.name,
      value,
    });
  }

  const body = JSON.stringify(
    {
      count: items.length,
      prefix: prefix || null,
      items,
    },
    null,
    2
  );

  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}
