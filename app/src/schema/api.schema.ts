import { z } from "zod";

export const SlotsQuery = z.object({
  date: z.string(),  // YYYY-MM-DD
  service: z.string().optional()
});

export const SlotsResponse = z.object({
  date: z.string(),
  open: z.array(z.string())
});

export const ReserveRequest = z.object({
  userId: z.string(),
  date: z.string(),
  time: z.string(),
  service: z.string(),
  note: z.string().optional()
});

export const ReserveResponse = z.object({
  id: z.string()
});
