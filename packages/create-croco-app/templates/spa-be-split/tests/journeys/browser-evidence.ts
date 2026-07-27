import { test as base, expect } from "@playwright/test";

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (message) => {
      if (message.type() === "error") {
        consoleErrors.push(message.text());
      }
    });
    page.on("pageerror", (error) => {
      consoleErrors.push(error.message);
    });
    page.on("requestfailed", (request) => {
      failedRequests.push(
        `${request.method()} ${request.url()} — ${request.failure()?.errorText ?? "unknown network failure"}`,
      );
    });
    page.on("response", (response) => {
      if (response.status() >= 400) {
        failedRequests.push(
          `${response.request().method()} ${response.url()} — HTTP ${response.status()}`,
        );
      }
    });

    try {
      await use(page);
    } finally {
      if (testInfo.status !== testInfo.expectedStatus) {
        await testInfo.attach("browser-console-errors.json", {
          body: Buffer.from(JSON.stringify(consoleErrors, null, 2)),
          contentType: "application/json",
        });
        await testInfo.attach("failed-network-requests.json", {
          body: Buffer.from(JSON.stringify(failedRequests, null, 2)),
          contentType: "application/json",
        });
      }
    }
  },
});

export { expect };
