import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SavedIntentConsole } from "../libs/SavedIntentConsole";
import type { SavedIntentConsoleProps } from "../libs/SavedIntentConsole";

const props: SavedIntentConsoleProps = {
  state: {
    kind: "ready",
    policies: [
      {
        scope: { appId: "reports", environment: "test", tenantId: "tenant" },
        resourceType: "report",
        displayLimit: 5,
        retentionDays: 30,
        excludeCompleted: true,
        revision: 0,
        actorId: "declaration",
        reason: "Default",
        updatedAt: "2026-10-05T00:00:00Z",
      },
    ],
  },
  canWrite: true,
  targets: [],
  onSave: vi.fn(),
  onInspect: vi.fn(),
  onReload: vi.fn(),
};
describe("SavedIntentConsole", () => {
  it("discards private inspection results when the policy scope changes with the same target ids", () => {
    const runner = fileURLToPath(new URL("./savedIntentConsoleBrowser.cjs", import.meta.url));
    const output = execFileSync(process.execPath, [runner], { encoding: "utf8", timeout: 30000 });
    expect(JSON.parse(output)).toEqual({ newScope: "tenant-b", oldScopeExclusionsVisible: 0 });
  }, 35000);

  it.each([
    [{ kind: "loading" }, "Loading saved intent policies"],
    [{ kind: "denied", message: "Permission denied" }, "Permission denied"],
    [{ kind: "error", message: "Provider unavailable" }, "Provider unavailable"],
  ] as const)("renders %s without a stale policy editor", (state, message) => {
    const html = renderToStaticMarkup(h(SavedIntentConsole, { ...props, state }));
    expect(html).toContain(message);
    expect(html).not.toContain("Save policy");
  });
  it("edits only declared policy fields with audit reason, and disables unauthorized writes", () => {
    const html = renderToStaticMarkup(h(SavedIntentConsole, { ...props, canWrite: false }));
    expect(html).toContain("Display limit");
    expect(html).toContain("Retention days");
    expect(html).toContain("Exclude completed");
    expect(html).toContain("Change reason");
    expect(html).toContain("fieldset disabled");
    expect(html).toContain("No authorized inspection targets");
    expect(html).not.toContain("href=");
  });
  it("exposes only authorized targets for bounded inspection", () => {
    const html = renderToStaticMarkup(
      h(SavedIntentConsole, { ...props, targets: [{ id: "opaque-1", label: "Customer ••42" }] }),
    );
    expect(html).toContain("Customer ••42");
    expect(html).toContain("Candidate availability and exclusions");
  });
});
