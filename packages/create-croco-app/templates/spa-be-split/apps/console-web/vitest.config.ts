import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["src/tests/**/*.spec.tsx"],
    setupFiles: ["./src/test/browser.ts"],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: "chromium" }],
      screenshotFailures: true,
      screenshotDirectory: "../../test-results/component/screenshots",
    },
  },
});
