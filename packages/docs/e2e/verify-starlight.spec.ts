import { expect, test } from "@playwright/test";

test("renders the English documentation home page", async ({ page }) => {
  const response = await page.goto("/en/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/Croco Framework Documentation/);
  await expect(
    page.getByRole("heading", { level: 1, name: "SaaS Backend Framework for AWS Lambda" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Start now/ })).toHaveAttribute(
    "href",
    "/en/guides/getting-started/",
  );
});
