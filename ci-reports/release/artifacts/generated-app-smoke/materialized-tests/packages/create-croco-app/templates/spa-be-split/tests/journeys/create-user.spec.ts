import { expect, test } from "./browser-evidence";

test("creates a user through the generated browser and Croco API flow", async ({ page }) => {
  await page.goto("/");

  const adminInvite = page.getByRole("button", { name: "Invite", exact: true });
  if ((await adminInvite.count()) > 0) {
    await page.getByPlaceholder("Name").fill("Browser Journey");
    await page.getByPlaceholder("Email").fill("browser.journey@example.com");
    await adminInvite.click();
    await expect(page.getByText("Invite queued for review.")).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "browser.journey@example.com", exact: true }),
    ).toBeVisible();
  } else {
    await page.getByPlaceholder("User name").fill("Browser Journey");
    await page.getByPlaceholder("Email").fill("browser.journey@example.com");
    const createResponse = page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/users" && response.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Create user" }).click();
    expect((await createResponse).ok()).toBe(true);
    await expect(
      page.getByRole("listitem").filter({ hasText: "browser.journey@example.com" }),
    ).toBeVisible();
  }
});
