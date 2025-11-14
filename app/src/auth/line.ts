import liff from "@line/liff";
const LIFF_ID = (import.meta as any).env.VITE_LIFF_ID as string;

export async function initLiff(): Promise<string> {
  if (!LIFF_ID) return "";
  if (!location.protocol.startsWith("https")) return "";
  await liff.init({ liffId: LIFF_ID });
  if (!liff.isLoggedIn()) liff.login();
  const prof = await liff.getProfile();
  return prof.userId;
}
