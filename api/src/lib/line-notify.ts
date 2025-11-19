export async function notifyLine(
  message: string,
  accessToken: string,
): Promise<void> {
  const endpoint = "https://api.line.me/v2/bot/message/broadcast";

  // 元の値も保持
  const raw = accessToken ?? "";
  // 改行削除 + trim
  const token = raw.replace(/[\r\n]/g, "").trim();

    rawLength: raw.length,
    tokenLength: token.length,
    head: token.slice(0, 10),
    tail: token.slice(-6),
  });

  if (!token) {
    console.error("notifyLine: LINE_MESSAGING_ACCESS_TOKEN is empty");
    throw new Error("LINE_MESSAGING_ACCESS_TOKEN is empty");
  }

  const body = {
    messages: [
      {
        type: "text",
        text: message,
      },
    ],
  };

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    console.error("notifyLine broadcast failed", res.status, text);
    throw new Error(`notifyLine failed: ${res.status}`);
  }
}
