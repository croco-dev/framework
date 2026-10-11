import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ExperimentConsole } from "../libs/ExperimentConsole";
import type { ExperimentConsoleProps } from "../libs/ExperimentConsole";
import type {
  ExperimentAdminSnapshot,
  ExperimentAdminCommand,
  ExperimentAdminConfigureCommand,
} from "@croco/admin-core";

/** Browser-only mounted regression harness; excluded from the shipped entrypoints. */
export async function verifyMountedExperimentConsole(container: HTMLElement): Promise<void> {
  const root = createRoot(container);
  const initial: ExperimentAdminSnapshot = {
    target: {
      experimentId: "checkout",
      experimentRevision: "1",
      scope: { app: "shop", environment: "test", tenantId: "a" },
    },
    definition: {
      id: "checkout",
      revision: "1",
      unit: "user",
      loginPolicy: "preserve-unit",
      allocatorVersion: "sha256-v1",
      allocation: 10000,
      variants: [{ id: "control", value: false, weight: 10000 }],
      hypothesis: "Confidence",
      observationPlan: "Completion",
      eligibility: "all",
      startsAt: "2030-01-02T03:00:00+09:00",
      endsAt: "2030-01-02T23:00:00-05:00",
    },
    state: "draft",
    version: 0,
    samples: [{ id: "owned", label: "Owned sample" }],
    canPreview: true,
    canOperate: true,
    canConfigure: true,
    eligibilityOptions: ["all"],
  };
  const commands: ExperimentAdminCommand[] = [];
  const configurations: ExperimentAdminConfigureCommand[] = [];
  let fail = true;
  let current = initial;
  let previewCalls = 0;
  const props: ExperimentConsoleProps = {
    state: { kind: "ready", snapshot: current },
    onCommand: async (command) => {
      commands.push(command);
      if (fail) throw new Error("Storage unavailable");
      current = {
        ...current,
        version: current.version + 1,
        state:
          command.action === "start"
            ? "running"
            : command.action === "pause"
              ? "paused"
              : "stopped",
      };
      render();
    },
    onConfigure: async (command) => {
      configurations.push(command);
    },
    onPreview: async () => {
      previewCalls++;
      return { status: "evaluated", value: false, reason: "local_preview" };
    },
    onReload: async () => {
      render();
    },
  };
  function render() {
    flushSync(() =>
      root.render(
        createElement(ExperimentConsole, { ...props, state: { kind: "ready", snapshot: current } }),
      ),
    );
  }
  function assert(condition: unknown, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  function button(label: string): HTMLButtonElement {
    const match = [...container.querySelectorAll("button")].find(
      (item) => item.textContent === label,
    );
    if (!match) throw new Error(`Missing button ${label}`);
    return match;
  }
  async function click(label: string) {
    flushSync(() => button(label).click());
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  function input(label: string, value: string) {
    const element = [...container.querySelectorAll("label")]
      .find((item) => item.textContent?.startsWith(label))
      ?.querySelector("input");
    assert(element, `Missing input ${label}`);
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    assert(set, "Input setter missing");
    flushSync(() => {
      set.call(element, value);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    });
  }
  try {
    render();
    const scheduleInputs = container.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );
    assert(
      scheduleInputs[0]?.value === "2030-01-01T18:00",
      "Positive-offset start must display its UTC date and time in the browser input",
    );
    assert(
      scheduleInputs[1]?.value === "2030-01-03T04:00",
      "Negative-offset end must display its UTC date and time in the browser input",
    );
    assert(button("Start experiment").disabled, "Reason must be required");
    await click("Preview sample");
    assert(
      previewCalls === 1 && container.textContent?.includes("evaluated · false"),
      "False preview must stay a successful evaluation",
    );
    input("Change reason", "Run regression");
    assert(!button("Start experiment").disabled, "Reason must enable start");
    await click("Start experiment");
    assert(
      container.querySelector('[role="alert"]')?.textContent === "Storage unavailable",
      "Command failure must stay visible",
    );
    fail = false;
    await click("Start experiment");
    assert(
      commands[0]?.idempotencyKey === commands[1]?.idempotencyKey,
      "Uncertain command retry must retain its key",
    );
    assert(
      current.state === "running" && !button("Pause experiment").disabled,
      "Successful start must enable pause",
    );
    await click("Pause experiment");
    assert(!button("Resume experiment").disabled, "Pause must enable resume");
    await click("Resume experiment");
    assert(
      !button("Pause experiment").disabled && !button("Stop experiment").disabled,
      "Resume must enable pause and stop",
    );
    await click("Stop experiment");
    assert(
      button("Start experiment").disabled && button("Stop experiment").disabled,
      "Stop must be terminal",
    );
    const disclosure = container.querySelector("details");
    assert(disclosure, "Configuration disclosure is missing");
    disclosure.open = true;
    input("New revision", "2");
    input("control weight", "5000");
    assert(button("Create draft revision").disabled, "Invalid weights must block configuration");
    assert(
      container.textContent?.includes("Variant weights must add up"),
      "Invalid weights must show a diagnostic",
    );
    input("Allocation", "5000");
    input("Starts at (UTC)", "2030-01-01T19:00");
    input("Ends at (UTC)", "2030-01-03T05:00");
    assert(!button("Create draft revision").disabled, "Valid configuration must enable creation");
    await click("Create draft revision");
    assert(
      configurations[0]?.configuration.revision === "2" &&
        configurations[0]?.configuration.allocation === 5000,
      "Configuration must submit selected revision and allocation",
    );
    assert(
      configurations[0]?.configuration.startsAt === "2030-01-01T19:00Z" &&
        configurations[0]?.configuration.endsAt === "2030-01-03T05:00Z",
      "Edited schedule inputs must submit the displayed UTC instants",
    );
    assert(
      configurations[0]?.expectedRevision === current.version,
      "Configuration must use current expected version",
    );
    current = {
      ...initial,
      target: { ...initial.target, scope: { ...initial.target.scope, tenantId: "b" } },
    };
    render();
    assert(button("Start experiment").disabled, "Changing ownership must clear the change reason");
    assert(!container.querySelector('[role="alert"]'), "Changing ownership must clear old errors");
  } finally {
    flushSync(() => root.unmount());
  }
}
