import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ReminderOperationsPanel } from "../libs/ReminderOperationsPanel";

describe("ReminderOperationsPanel", () => {
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
