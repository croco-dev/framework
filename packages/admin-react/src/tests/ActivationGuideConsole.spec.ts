import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ActivationGuideConsole } from "../libs/ActivationGuideConsole";
import type { ActivationGuideConsoleProps } from "../libs/ActivationGuideConsole";

const definition: ActivationGuideConsoleProps["definition"] = {
  id: "first-report",
  version: "v1",
  anchor: "signup",
  actionId: "report.saved",
  windowMs: 604_800_000,
  allowedLatenessMs: 86_400_000,
  timezone: "Asia/Seoul",
  countMode: "events",
  threshold: 1,
  deletedObjectPolicy: "retain",
  title: "Save a report",
  description: "Save the first report to finish setup.",
  nextActionHref: "/reports/new",
  guidanceSteps: [{ id: "open-reports", title: "Open Reports", href: "/reports" }],
};
const props: ActivationGuideConsoleProps = {
  access: {
    scope: { tenantId: "tenant", appId: "app", environmentId: "test" },
    actor: "operator",
    permissions: ["onboarding.goal.read", "onboarding.goal.preview", "onboarding.goal.publish"],
  },
  definition,
  state: { kind: "empty" },
  targets: [],
  asOf: "2026-09-28T00:00:00Z",
  onPreview: vi.fn(),
  onPublish: vi.fn(),
};

describe("Activation guide console", () => {
  it.each([
    [{ kind: "loading" }, "Loading activation guide"],
    [{ kind: "denied", code: "forbidden" }, "Access denied"],
    [{ kind: "error", code: "unavailable" }, "Guide unavailable"],
  ] as const)("renders %s state explicitly", (state, text) => {
    expect(renderToStaticMarkup(h(ActivationGuideConsole, { ...props, state }))).toContain(text);
  });

  it("edits goal and step guidance without a goal completion control", () => {
    const markup = renderToStaticMarkup(h(ActivationGuideConsole, props));
    expect(markup).toContain("No published goal");
    expect(markup).toContain("Goal title");
    expect(markup).toContain("Step 1 title");
    expect(markup).toContain("Target preview");
    expect(markup).toContain("No verified preview targets");
    expect(markup).not.toContain("Complete goal");
  });

  it("shows partial preview evidence and denies unauthorized actions", () => {
    const markup = renderToStaticMarkup(
      h(ActivationGuideConsole, {
        ...props,
        access: { ...props.access, permissions: ["onboarding.goal.read"] },
        state: {
          kind: "partial",
          published: { definition, revision: 1, actor: "operator", reason: "Initial guide" },
          message: "Recent activity is still being checked",
        },
      }),
    );
    expect(markup).toContain("Recent activity is still being checked");
    expect(markup).toContain('disabled=""');
  });
});
