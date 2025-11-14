import { z } from "zod";

export const Service = z.object({
  id: z.string(),
  name: z.string(),
  durationMin: z.number().int().positive(),
});

export const AppConfig = z.object({
  brand: z.object({ name: z.string(), primaryColor: z.string().optional() }),
  services: z.array(Service).nonempty(),
  businessHours: z.object({
    tz: z.string(),
    days: z.record(z.string(), z.array(z.string()))
  }),
  ui: z.object({
    calendar: z.object({
      showHolidays: z.boolean().default(true),
      minAdvanceHours: z.number().int().nonnegative().default(0)
    }),
    texts: z.object({
      reserveButton: z.string(),
      myPage: z.string()
    })
  })
});

export type AppConfig = z.infer<typeof AppConfig>;
