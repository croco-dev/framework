import { describe, expect, it, vi } from "vitest";
import { ActivationGuideConsole } from "../libs/ActivationGuideConsole";
import type { ActivationGuideConsoleProps } from "../libs/ActivationGuideConsole";

const effects = vi.hoisted(() => ({ dependencies: [] as unknown[][] }));

vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useEffect: (_effect: () => void, dependencies: unknown[]) => {
    effects.dependencies.push(dependencies);
  },
  useRef: <T>(initial: T) => ({ current: initial }),
  useState: <T>(initial: T) => [initial, () => {}] as const,
}));

const props: ActivationGuideConsoleProps = {
  access: {
    scope: { tenantId: "a:b", appId: "c", environmentId: "test" },
    actor: "operator",
    permissions: ["onboarding.goal.read"],
  },
  definition: {
    id: "first-report",
    version: "v1",
    anchor: "signup",
    actionId: "report.saved",
    windowMs: 86_400_000,
    allowedLatenessMs: 0,
    timezone: "UTC",
    countMode: "events",
    threshold: 1,
    deletedObjectPolicy: "retain",
    title: "Save a report",
  },
  state: { kind: "empty" },
  targets: [],
  asOf: "2026-09-28T00:00:00Z",
  onPreview: vi.fn(),
  onPublish: vi.fn(),
};

describe("Activation guide scope identity", () => {
  it("resets the editor when differently scoped identifiers contain delimiters", () => {
    effects.dependencies = [];
    ActivationGuideConsole(props);
    ActivationGuideConsole({
      ...props,
      access: {
        ...props.access,
        scope: { ...props.access.scope, tenantId: "a", appId: "b:c" },
      },
    });

    expect(effects.dependencies).toHaveLength(2);
    expect(effects.dependencies[0]).not.toEqual(effects.dependencies[1]);
  });
});
