import { expect, test } from "./browser-evidence";

test("reviews, corrects, publishes, and schedules an immutable plan release", async ({ page }) => {
  await page.goto("/");

  const workflow = page.getByRole("region", {
    name: "Generated monetization plan release example",
  });
  const console = workflow.getByRole("region", { name: "Plan release console" });

  await expect(workflow.getByText("Fake workflow state: draft")).toBeVisible();
  const effectiveTime = console.getByLabel("Effective time");
  await effectiveTime.fill("");
  await console.getByRole("button", { name: "Validate draft" }).click();
  await expect(
    console.getByText("CROCO_BILLING_EFFECTIVE_TIME_INVALID", { exact: false }),
  ).toBeVisible();
  await expect(console.getByRole("button", { name: "Approve exact draft revision" })).toHaveCount(
    0,
  );
  await console.getByRole("button", { name: "Return to draft", exact: true }).click();
  await effectiveTime.fill("2027-01-01T00:00");
  await console.getByRole("button", { name: "Validate draft" }).click();
  await expect(workflow.getByText("Fake workflow state: validation")).toBeVisible();
  await expect(console.getByText("credential-free-structural", { exact: false })).toBeVisible();
  await expect(console.getByText("remote-provider-preflight", { exact: false })).toBeVisible();

  await console.getByRole("button", { name: "Approve exact draft revision" }).click();
  await expect(workflow.getByText("Fake workflow state: blocked-publish")).toBeVisible();
  await expect(console.getByText("FAKE_PROVIDER_PRICE_MISSING", { exact: false })).toBeVisible();
  await expect(console.getByRole("button", { name: "Publish reviewed version" })).toHaveCount(0);

  const returnToDraft = console.getByRole("button", { name: "Return to draft", exact: true });
  const diagnosticRecovery = console.getByRole("button", {
    name: "Return to draft and select Fake Stripe",
  });
  await diagnosticRecovery.focus();
  await page.keyboard.press("Enter");
  await expect(returnToDraft).toBeFocused();
  await returnToDraft.click();
  await console.getByLabel("Provider binding").selectOption({ label: "Fake Stripe" });
  await console.getByRole("button", { name: "Validate draft" }).click();
  await console.getByRole("button", { name: "Approve exact draft revision" }).click();
  await expect(workflow.getByText("Fake workflow state: review")).toBeVisible();

  const publish = console.getByRole("button", { name: "Publish reviewed version" });
  await publish.click();
  const publishDialog = console.getByRole("alertdialog");
  await expect(publishDialog).toContainText("generated-operator");
  await expect(publishDialog).toContainText("plan-release-review");
  await expect(publishDialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    publishDialog.getByRole("button", { name: "Confirm Publish reviewed version" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(publishDialog.getByRole("button", { name: "Cancel" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(publishDialog).toHaveCount(0);
  await expect(publish).toBeFocused();

  await publish.click();
  await console.getByRole("button", { name: "Confirm Publish reviewed version" }).click();
  await expect(workflow.getByText("Fake workflow state: corrected-publish")).toBeVisible();
  await expect(console.getByRole("listitem").filter({ hasText: "Pro (pro@2027-01)" })).toHaveCount(
    1,
  );
  await expect(console.getByRole("region", { name: "Published release receipt" })).toBeVisible();

  await workflow.getByRole("button", { name: "Reset plan release workflow" }).click();
  await console.getByLabel("Provider binding").selectOption({ label: "Fake Stripe" });
  await console.getByRole("button", { name: "Validate draft" }).click();
  await console.getByRole("button", { name: "Approve exact draft revision" }).click();
  await console.getByRole("button", { name: "Schedule reviewed version" }).click();
  await console.getByRole("button", { name: "Confirm Schedule reviewed version" }).click();
  await expect(workflow.getByText("Fake workflow state: scheduled-publish")).toBeVisible();
  await expect(console.getByText("Scheduled for 2027-01-01T00:00:00.000Z")).toBeVisible();
});
