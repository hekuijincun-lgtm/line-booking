import type { AppConfig } from "../schema/config.schema";
export function mapConfigToCalendarProps(cfg: AppConfig){
  return {
    tz: cfg.businessHours.tz,
    minAdvanceHours: cfg.ui.calendar.minAdvanceHours,
  };
}
