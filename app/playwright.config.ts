import { defineConfig } from "@playwright/test";
export default defineConfig({
  use: { baseURL: process.env.APP_URL || "http://localhost:5173" },
  webServer: process.env.APP_URL ? undefined : {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: true
  }
});
