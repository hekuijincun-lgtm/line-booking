import { Hono } from "hono";
export const publicApi = new Hono();

publicApi.get("/slots", (c) => {
  const date = c.req.query("date");
  if (!date) return c.json({ error: "date required" }, 400);
  return c.json({ date, open: ["10:00","10:30","11:00"] });
});

publicApi.post("/reserve", async (c) => {
  const b = await c.req.json().catch(() => null) as any;
  if (!b?.date || !b?.time || !b?.service) return c.json({ error: "invalid body" }, 400);
  return c.json({ id: `rsv_${crypto.randomUUID()}` });
});