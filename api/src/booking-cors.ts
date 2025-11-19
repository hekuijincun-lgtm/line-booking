/**
 * Kazuki Booking: 共通 CORS ヘルパー
 */

export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*", // 必要なら booking-ui の本番ドメインに絞ってOK
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

/** OPTIONS / プリフライト用 */
export function handleCorsOptions(request: Request): Response {
  const acrMethod = request.headers.get("Access-Control-Request-Method");
  if (acrMethod) {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

/** 任意の Response に CORS ヘッダを付与 */
export function withCors(resp: Response): Response {
  const headers = new Headers(resp.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    headers.set(key, value);
  }

  return new Response(resp.body, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
}
