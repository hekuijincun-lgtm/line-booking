const LINE_NOTIFY_ENDPOINT = "https://notify-api.line.me/api/notify";

export async function notifyLine(token: string | undefined, message: string): Promise<void> {
  if (!token) {
    console.error("LINE_NOTIFY_TOKEN is not set. Skip LINE Notify.");
    return;
  }

  try {
    const body = new URLSearchParams({ message });

    const res = await fetch(LINE_NOTIFY_ENDPOINT, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "<no body>");
      console.error("LINE Notify error", res.status, text);
    }
  } catch (err) {
    console.error("LINE Notify fetch failed", err);
  }
}
