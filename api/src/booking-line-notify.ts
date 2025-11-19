import { Hono } from "hono";
import { notifyLine } from "./lib/line-notify";
import { getReservationById } from "./services/booking-storage";

export const lineNotifyApp = new Hono();

lineNotifyApp.post("/", async (c) => {
  try {
    const body = await c.req.json();
    const reserveId = (body as { reserveId?: string }).reserveId;

    if (!reserveId) {
      return c.json({ ok: false, error: "reserveId required" }, 400);
    }

    const data = await getReservationById(reserveId);
    if (!data) {
      return c.json({ ok: false, error: "not found" }, 404);
    }

    const msgLines = [
      "🙇‍♀️ご予約ありがとうございます！",
      "📌 お名前: " + (data.name || "未入力"),
      "🗓 日時: " + data.date + " " + data.time,
      "🔑 予約ID: " + reserveId,
      "",
      "変更・キャンセルをご希望の場合はこちらからご連絡ください✨",
    ];

    const msg = msgLines.join("\n");

    await notifyLine(msg);
    return c.json({ ok: true });
  } catch (err) {
    console.error("lineNotify error", err);
    return c.json({ ok: false }, 500);
  }
});
