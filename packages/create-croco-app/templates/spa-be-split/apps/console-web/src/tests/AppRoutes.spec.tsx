import { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";
import { AppRoutes } from "../AppRoutes";

vi.mock("../App", () => ({ default: () => <h1>Existing root application</h1> }));

const originalUrl = window.location.href;
function UsagePage() {
  const [tenantId] = useState(() => new URLSearchParams(window.location.search).get("tenantId"));
  return (
    <main>
      <h1>Usage dashboard</h1>
      <p>{tenantId}</p>
    </main>
  );
}

const routes = [
  { path: "/settings/account", Component: () => <h1>Account settings</h1> },
  { path: "/usage", Component: UsagePage },
];

afterEach(() => {
  window.history.replaceState(null, "", originalUrl);
});

test("renders each configured page at its URL independently of query parameters", async () => {
  window.history.replaceState(null, "", "/settings/account?tab=profile");
  const screen = await render(<AppRoutes routes={routes} />);
  await expect.element(screen.getByRole("heading", { name: "Account settings" })).toBeVisible();

  window.history.replaceState(null, "", "/usage?tenantId=tenant-a");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await expect.element(screen.getByRole("heading", { name: "Usage dashboard" })).toBeVisible();
  await expect.element(screen.getByText("tenant-a", { exact: true })).toBeVisible();

  window.history.replaceState(null, "", "/usage?tenantId=tenant-b");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await expect.element(screen.getByText("tenant-b", { exact: true })).toBeVisible();
});

test("preserves the root application when returning from a generated page", async () => {
  window.history.replaceState(null, "", "/usage");
  const screen = await render(<AppRoutes routes={routes} />);
  await expect.element(screen.getByRole("heading", { name: "Usage dashboard" })).toBeVisible();

  window.history.replaceState(null, "", "/");
  window.dispatchEvent(new PopStateEvent("popstate"));
  await expect
    .element(screen.getByRole("heading", { name: "Existing root application" }))
    .toBeVisible();
});
