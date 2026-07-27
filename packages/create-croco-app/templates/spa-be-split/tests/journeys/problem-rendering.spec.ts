import { expect, test } from "./browser-evidence";

const PROBLEM = {
  type: "https://example.test/problems/journey-unavailable",
  title: "Journey API unavailable",
  status: 503,
  detail: "The browser journey received an API Problem.",
  code: "starter/journey-api-unavailable",
  recovery: "Retry after checking the generated API server.",
};

test("keeps an API Problem visible to the user", async ({ page }, testInfo) => {
  await page.route(
    (url) => url.pathname === "/api/users",
    async (route) => {
      await route.fulfill({
        status: PROBLEM.status,
        contentType: "application/problem+json",
        body: JSON.stringify(PROBLEM),
      });
    },
  );
  await page.goto("/");

  const adminProbe = page.getByRole("button", { name: "Probe Missing User" });
  const isAdminConsole = (await adminProbe.count()) > 0;
  if (isAdminConsole) {
    await adminProbe.click();
    await expect(page.getByRole("alert")).toContainText("admin-console/user-not-found");
  } else {
    const alert = page.getByRole("alert");
    await expect(alert).toContainText(PROBLEM.code);
    await expect(alert).toContainText(String(PROBLEM.status));
    await expect(alert).toContainText(PROBLEM.detail);
    await expect(alert).toContainText(PROBLEM.recovery);
  }

  await testInfo.attach("api-problem-evidence.json", {
    body: Buffer.from(
      JSON.stringify(
        {
          expectedProblemCode: isAdminConsole ? "admin-console/user-not-found" : PROBLEM.code,
          transport: "browser-to-generated-croco-api",
        },
        null,
        2,
      ),
    ),
    contentType: "application/json",
  });
});
