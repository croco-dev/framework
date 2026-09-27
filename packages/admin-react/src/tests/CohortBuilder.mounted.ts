import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { CohortBuilder } from "../libs/CohortBuilder";
import type { CohortDefinition } from "@croco/cohort-core";
import type { CohortBuilderProps } from "../libs/CohortBuilder";

/** Browser regression fixture; runs against React's mounted component lifecycle. */
export async function verifyMountedCohortBuilder(
  container: HTMLElement,
  observe: (step: string) => Promise<void> = async () => {},
): Promise<void> {
  const root = createRoot(container);
  const requests: CohortDefinition[] = [];
  let rejectPrevious: ((reason: Error) => void) | undefined;
  const initial: CohortDefinition = {
    id: "trial",
    version: 1,
    scope: { appId: "app", environment: "test", tenantId: "tenant-a" },
    subjectKind: "customer",
    root: { kind: "all", children: [{ kind: "static", membershipId: "invited" }] },
  };
  let props: CohortBuilderProps = {
    definition: initial,
    registration: { fields: {}, events: ["report.created"], memberships: ["invited"] },
    state: { kind: "ready", history: [] },
    actor: "operator",
    asOf: "2026-09-27T00:00:00Z",
    canPreview: true,
    canPublish: true,
    onPreview: async ({ definition }) => {
      requests.push(definition);
    },
    onPublish: async () => {},
  };
  function assert(condition: boolean, message: string) {
    if (!condition) throw new Error(message);
  }
  function render() {
    flushSync(() => root.render(createElement(CohortBuilder, props)));
  }
  async function click(label: string) {
    const button = Array.from(container.querySelectorAll("button")).find(
      (element) => element.textContent === label,
    );
    if (!button) throw new Error(`Missing button: ${label}`);
    flushSync(() => button.click());
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  function assertFreshDraft() {
    assert(!container.textContent?.includes("Observed behavior"), "Old predicate survived switch");
    assert(container.textContent?.includes("version 1") === true, "Old version survived switch");
    assert(!container.querySelector('[role="alert"]'), "Old error survived switch");
    assert(
      container.querySelector("section")?.getAttribute("aria-busy") === "false",
      "Old pending state survived switch",
    );
  }
  try {
    render();
    await observe("Initial tenant-a definition");
    await click("Add event: report.created");
    props = { ...props, definition: { ...initial, scope: { ...initial.scope } }, actor: "another" };
    render();
    await click("Preview cohort");
    assert(requests[0]?.version === 2, "Ordinary rerender discarded draft version");
    assert(
      requests[0]?.root.kind === "all" && requests[0].root.children.length === 2,
      "Ordinary rerender discarded edited predicate",
    );
    await observe("Same identity rerender preserves edited draft");
    props = {
      ...props,
      onPreview: () =>
        new Promise<void>((_resolve, reject) => {
          rejectPrevious = reject;
        }),
    };
    render();
    await click("Preview cohort");
    props = {
      ...props,
      definition: { ...initial, scope: { ...initial.scope, tenantId: "tenant-b" } },
      onPreview: async ({ definition }) => {
        requests.push(definition);
      },
    };
    render();
    assertFreshDraft();
    await observe("Switch tenant while old request is pending resets draft and busy state");
    rejectPrevious?.(new Error("Previous tenant request failed"));
    await new Promise((resolve) => setTimeout(resolve, 0));
    assertFreshDraft();
    await click("Preview cohort");
    assert(requests.at(-1)?.scope.tenantId === "tenant-b", "New callback received old tenant");
    assert(requests.at(-1)?.version === 1, "New callback received old draft");
    await observe("Old request failure cannot overwrite new tenant state");
    const switches: CohortDefinition[] = [
      { ...props.definition, id: "paid" },
      { ...props.definition, scope: { ...props.definition.scope, appId: "other-app" } },
      { ...props.definition, scope: { ...props.definition.scope, environment: "production" } },
      { ...props.definition, subjectKind: "account" },
    ];
    for (const definition of switches) {
      await click("Add event: report.created");
      props = { ...props, definition };
      render();
      assertFreshDraft();
      await click("Preview cohort");
      assert(requests.at(-1) === definition, "Identity switch submitted a stale definition");
    }
    await observe("PASS: cohort, app, environment and subject switches use fresh definitions");
  } finally {
    root.unmount();
  }
}
