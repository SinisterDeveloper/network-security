import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./src",
  fullyParallel: true,
  use: { baseURL: "http://localhost:8080" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
