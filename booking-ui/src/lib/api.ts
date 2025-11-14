export const API_BASE   = import.meta.env.VITE_API_BASE as string;
export const LOGIN_URL  = import.meta.env.VITE_LOGIN_URL as string;
export const SLOTS_PATH = import.meta.env.VITE_SLOTS_PATH as string;
export const RESV_PATH  = import.meta.env.VITE_RESERVE_PATH as string;
export const MY_PATH    = import.meta.env.VITE_MY_PATH as string;

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    },
    // 認証Cookieを使うなら:
    // credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)");
    throw new Error(`HTTP ${res.status} ${res.statusText} - ${text}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  slots(dateISO: string) {
    const u = new URL(SLOTS_PATH, "http://x");
    u.searchParams.set("date", dateISO);
    return req<{ slots: Slot[] }>(u.pathname + u.search);
  },
  reserve(input: ReserveInput) {
    return req<{ ok: true; id: string }>(RESV_PATH, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },
  me() {
    return req<{ reservations: Reservation[] }>(MY_PATH);
  },
};

// types
export type Slot = {
  id: string;
  start: string; // ISO
  end: string;   // ISO
  capacity?: number;
  remaining?: number;
};

export type ReserveInput = {
  slotId: string;
  name: string;
  phone?: string;
  note?: string;
};

export type Reservation = {
  id: string;
  slotId: string;
  start: string;
  end: string;
  name: string;
  status: "reserved" | "canceled" | "completed";
};
