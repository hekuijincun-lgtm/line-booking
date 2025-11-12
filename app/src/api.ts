import { z } from "zod";
import { SlotsQuery, SlotsResponse, ReserveRequest, ReserveResponse } from "./schema/api.schema";

const API_BASE = import.meta.env.VITE_API_BASE as string;

async function $fetch<T>(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function getSlots(q: z.infer<typeof SlotsQuery>, userId?: string) {
  const usp = new URLSearchParams({ date: q.date });
  if (q.service) usp.set("service", q.service);
  return $fetch<z.infer<typeof SlotsResponse>>(`/api/public/slots?${usp.toString()}`, {
    headers: userId ? { "X-Line-User-Id": userId } : {}
  });
}

export async function postReserve(body: z.infer<typeof ReserveRequest>, userId?: string) {
  return $fetch<z.infer<typeof ReserveResponse>>(`/api/public/reserve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(userId ? { "X-Line-User-Id": userId } : {})
    },
    body: JSON.stringify(body)
  });
}
