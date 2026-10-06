import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReminderOperationsPanel } from "../libs/ReminderOperationsPanel";

describe("ReminderOperationsPanel", () => {
  it("hides rows in the permission-revocation commit and preserves scoped row identity", () => {
    const runner = fileURLToPath(new URL("./reminderOperationsBrowser.cjs", import.meta.url));
    const result = JSON.parse(
      execFileSync(process.execPath, [runner], { encoding: "utf8", timeout: 30000 }),
    );
    expect(result).toMatchObject({
      commitResult: "PASS: no protected rows in the revocation commit",
      retainedFirst: true,
      retainedSecond: true,
      retainedThird: true,
      rowsAfterRevocation: 0,
      reloadAfterRevocation: 0,
      errors: [],
      consoleErrors: [],
    });
  }, 30000);

  it("renders loading without mutation or owner enabling controls", () => {
    const source = { load: vi.fn(), cancel: vi.fn() };
    const html = renderToString(
      createElement(ReminderOperationsPanel, {
        scopeKey: "tenant",
        actor: "operator",
        permissions: ["reminder.read"],
        source,
      }),
    );
    expect(html).toContain("Loading reminder operations");
    expect(html).not.toContain("Create reminder");
    expect(html).not.toContain("Enable");
    expect(source.cancel).not.toHaveBeenCalled();
  });
});
