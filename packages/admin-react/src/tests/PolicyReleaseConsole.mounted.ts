import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PolicyReleaseConsole } from "../libs/PolicyReleaseConsole";
import type {
  PolicyReleaseConsoleProps,
  PolicyReleaseConsoleState,
} from "../libs/PolicyReleaseConsole";

type ReadyState = Extract<PolicyReleaseConsoleState, { kind: "ready" }>;

/** Browser regression fixture exercising React's mounted input and editor lifecycle. */
export async function verifyMountedPolicyReleaseConsole(
  container: HTMLElement,
  observe: (step: string) => Promise<void> = async () => {},
): Promise<void> {
  const root = createRoot(container);
  const initial: ReadyState = {
    kind: "ready",
    policyId: "banner",
    revision: 3,
    status: "draft",
    fields: [
      { key: "rules", label: "Rules", input: "json", value: { enabled: true } },
      { key: "title", label: "Title", input: "text", value: "Banner" },
      { key: "limit", label: "Limit", input: "number", value: 3 },
      {
        key: "mode",
        label: "Mode",
        input: "select",
        value: "all",
        options: [
          { value: "all", label: "All" },
          { value: "restricted", label: "Restricted" },
        ],
      },
    ],
    diagnostics: [],
    diff: [],
    impact: [],
    reviewHash: "review-3",
    canWrite: true,
    canReview: true,
    canPublish: true,
  };
  const edits: unknown[] = [];
  let reloads = 0;
  let props: PolicyReleaseConsoleProps = {
    state: initial,
    reason: "Update rules",
    effectiveAt: "",
    onReasonChange: () => {},
    onEffectiveAtChange: () => {},
    onEdit: (field, value) => {
      edits.push(value);
      replaceValue(value, field);
    },
    onSave: () => {},
    onReview: () => {},
    onPublish: () => {},
    onReload: () => {
      reloads += 1;
    },
  };
  function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  function render(state: PolicyReleaseConsoleState = props.state) {
    props = { ...props, state };
    flushSync(() => root.render(createElement(PolicyReleaseConsole, props)));
  }
  function ready(): ReadyState {
    assert(props.state.kind === "ready", "Expected ready state");
    return props.state;
  }
  function replaceValue(value: unknown, key = "rules") {
    const state = ready();
    props = {
      ...props,
      state: {
        ...state,
        fields: state.fields.map((field) => (field.key === key ? { ...field, value } : field)),
      },
    };
    root.render(createElement(PolicyReleaseConsole, props));
  }
  function textarea(): HTMLTextAreaElement {
    const element = container.querySelector<HTMLTextAreaElement>('textarea[name="rules"]');
    assert(element !== null, "Missing JSON textarea");
    return element;
  }
  function button(label: string): HTMLButtonElement {
    const element = Array.from(container.querySelectorAll("button")).find(
      (item) => item.textContent === label,
    );
    assert(element !== undefined, `Missing button: ${label}`);
    return element;
  }
  function type(text: string, caret = text.length) {
    const element = textarea();
    element.focus();
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    assert(setter !== undefined, "Missing native textarea value setter");
    setter.call(element, text);
    element.setSelectionRange(caret, caret);
    flushSync(() => element.dispatchEvent(new Event("input", { bubbles: true })));
    return element;
  }
  function assertFresh(value: unknown = { enabled: true }) {
    assert(textarea().value === JSON.stringify(value, null, 2), "Stale JSON draft survived reset");
    assert(!container.textContent?.includes("Enter valid JSON"), "Stale JSON error survived reset");
    for (const label of ["Save draft", "Review revision", "Publish reviewed revision"])
      assert(!button(label).disabled, `${label} remains blocked by stale JSON`);
  }
  try {
    render();
    await observe("Initial ready policy");
    const first = type('{"enabled":');
    assert(first.value === '{"enabled":', "Invalid typing was discarded");
    assert(first.getAttribute("aria-invalid") === "true", "Invalid JSON was not flagged");
    assert(edits.length === 0, "Invalid JSON reached onEdit");
    assert(button("Save draft").disabled, "Invalid JSON did not block save");
    render({ ...ready() });
    assert(
      textarea() === first && first.value === '{"enabled":',
      "Ordinary rerender discarded invalid draft",
    );
    await observe("Invalid JSON persists and blocks actions");
    render({ ...initial, policyId: "checkout" });
    assertFresh();
    await observe("Different policy at same revision resets JSON draft");
    for (const state of [
      { kind: "loading" },
      { kind: "error", code: "LOAD_FAILED", message: "Try again" },
    ] as const) {
      type("{");
      const previous = ready();
      render(state);
      await observe(`${state.kind} leaves ready editor`);
      render(previous);
      assertFresh();
      await observe(`${state.kind} recovery resets JSON draft`);
    }
    type("{");
    render({ ...ready(), revision: 4 });
    assertFresh();
    await observe("Revision change resets JSON draft");
    const raw = '{  "enabled" : false  }';
    const caret = 8;
    const node = type(raw, caret);
    assert(edits.slice().length === 1, "Valid JSON did not emit exactly once");
    assert(textarea() === node, "Exact parent echo remounted the textarea");
    assert(node.value === raw, "Exact parent echo discarded raw formatting");
    assert(document.activeElement === node, "Exact parent echo lost focus");
    assert(
      node.selectionStart === caret && node.selectionEnd === caret,
      "Exact parent echo moved caret",
    );
    render({ ...ready() });
    assert(node.value === raw && textarea() === node, "Ordinary rerender lost acknowledged draft");
    await observe("Valid JSON exact echo preserves formatting, node, focus and caret");
    flushSync(() => replaceValue({ enabled: false }));
    assertFresh({ enabled: false });
    await observe("Fresh equal-content JSON replacement resets raw draft");
    type("{");
    flushSync(() => replaceValue({ replacement: true }));
    assertFresh({ replacement: true });
    await observe("Fresh same-revision JSON replacement clears invalid draft");
    type("{");
    flushSync(() => button("Reload policy").click());
    assert(reloads === 1, "Reload callback was not called exactly once");
    assertFresh({ replacement: true });
    await observe("Direct Reload clears raw JSON and validation");
    for (const [name, value] of [
      ["title", "Updated"],
      ["limit", "7"],
    ] as const) {
      const element = container.querySelector<HTMLInputElement>(`input[name="${name}"]`);
      assert(element !== null, `Missing ${name} input`);
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
      assert(setter !== undefined, "Missing native input value setter");
      setter.call(element, value);
      flushSync(() => element.dispatchEvent(new Event("input", { bubbles: true })));
      const expected = name === "limit" ? 7 : value;
      assert(
        ready().fields.find((field) => field.key === name)?.value === expected,
        `${name} callback changed`,
      );
      assert(element.value === value, `${name} controlled value changed`);
    }
    const mode = container.querySelector<HTMLSelectElement>('select[name="mode"]');
    assert(mode !== null, "Missing mode select");
    mode.value = "restricted";
    flushSync(() => mode.dispatchEvent(new Event("change", { bubbles: true })));
    assert(
      ready().fields.find((field) => field.key === "mode")?.value === "restricted",
      "Select callback changed",
    );
    await observe("Text, number and select inputs preserve their typed callbacks");
    type("{");
    const beforeRemoval = ready();
    render({ ...beforeRemoval, fields: [] });
    assert(!button("Save draft").disabled, "Removed invalid field still blocks save");
    render(beforeRemoval);
    assertFresh({ replacement: true });
    type("{");
    render({
      ...ready(),
      fields: ready().fields.map((field) =>
        field.key === "rules" ? { ...field, sensitive: true } : field,
      ),
    });
    assert(textarea().value === "", "Sensitive flag exposed previous JSON draft");
    assert(!button("Save draft").disabled, "Sensitive flag retained invalid JSON state");
    await observe("PASS: removed fields and sensitivity changes clear stale JSON");
  } finally {
    flushSync(() => root.unmount());
  }
}
