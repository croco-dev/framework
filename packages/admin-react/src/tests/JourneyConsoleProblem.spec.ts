import { isValidElement } from "react";
import type { ReactElement } from "react";
import { describe, expect, it, vi } from "vitest";
import { JourneyConsole } from "../libs/JourneyConsole";
import type { JourneyConsoleProps } from "../libs/JourneyConsole";

const hooks = vi.hoisted(() => ({ values: [] as unknown[], index: 0 }));
vi.mock("react", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useState: (initial: unknown) => {
    const index = hooks.index++;
    if (!(index in hooks.values)) hooks.values[index] = initial;
    return [
      hooks.values[index],
      (value: unknown) => {
        hooks.values[index] = value;
      },
    ];
  },
}));
function elements(node: unknown): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements);
  if (!isValidElement<Record<string, unknown>>(node)) return [];
  return [node, ...elements(node.props.children)];
}
const props: JourneyConsoleProps = {
  scopeKey: "tenant/app/test",
  definition: {
    id: "welcome",
    version: "1",
    entry: "end",
    goal: { registration: "done", params: {} },
    reentry: "once",
    unknownRetryMs: 1000,
    unknownDeadlineMs: 5000,
    nodes: [{ id: "end", kind: "end" }],
  },
  state: { kind: "empty" },
  permissions: ["journey.read", "journey.preview"],
  samples: [{ id: "sample", label: "Sample" }],
  onDryRun: vi.fn(),
  onCommand: vi.fn(),
};
describe("Journey console operation Problems", () => {
  it.each([
    [
      { code: "lifecycle-core/journey-revision", message: "private provider detail" },
      "lifecycle-core/journey-revision",
    ],
    [{ message: "private provider detail" }, "journey/operation-failed"],
    [
      { code: "private provider detail", message: "private provider detail" },
      "journey/operation-failed",
    ],
  ])("shows safe code and recovery guidance without provider details", async (failure, code) => {
    hooks.values = [];
    hooks.index = 0;
    const onDryRun = vi.fn().mockRejectedValue(failure);
    const wrapper = JourneyConsole({ ...props, onDryRun });
    const editor = wrapper.type as (input: JourneyConsoleProps) => ReactElement;
    const render = () => {
      hooks.index = 0;
      return editor({ ...props, onDryRun });
    };
    const button = elements(render()).find(
      (element) => element.type === "button" && element.props.children === "Dry run",
    );
    expect(button).toBeDefined();
    (button?.props.onClick as () => void)();
    await vi.waitFor(() => expect(hooks.values[4]).toBe(code));
    const alert = elements(render()).find((element) => element.props.role === "alert");
    expect(alert?.props.children).toContain(code);
    expect(alert?.props.children).toContain("Refresh episode state");
    expect(alert?.props.children).not.toContain("private provider detail");
  });
});
