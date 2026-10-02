import { createElement as h } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { ExperienceSlot } from "../libs/ExperienceSlot";
import type { ExperienceDecision, ExposureHandle } from "@croco/experience-core";

/** Browser regression fixture for the modal's mounted focus lifecycle. */
export async function verifyMountedExperienceSlot(
  container: HTMLElement,
  opener: HTMLButtonElement,
  observe: (step: string) => Promise<void> = async () => {},
): Promise<void> {
  const root = createRoot(container);
  const initial: ExperienceDecision = {
    decisionId: "preview-1",
    placementId: "help",
    configId: "help",
    policyVersion: 1,
    scope: { appId: "synthetic", environment: "test", tenantId: "synthetic" },
    subject: { kind: "preview", id: "preview" },
    renderer: "modal",
    content: { locale: "en", title: "Display label", body: "Synthetic local modal" },
    selectedAt: "2026-09-30T00:00:00Z",
    expiresAt: "2026-10-01T00:00:00Z",
    reason: "matched",
  };
  const handle: ExposureHandle = {
    decisionId: initial.decisionId,
    exposureId: "synthetic-exposure",
    surfaceInstanceId: "synthetic-surface",
    token: "synthetic-token",
  };
  let exposures = 0;
  let dismissals = 0;
  const renderers = {
    modal: () => h("label", null, "Label", h("input", { defaultValue: "hello" })),
    banner: () => h("p", null, "Banner"),
  };
  function assert(condition: boolean, message: string): asserts condition {
    if (!condition) throw new Error(message);
  }
  function render(decision: ExperienceDecision | null) {
    flushSync(() =>
      root.render(
        h(ExperienceSlot, {
          decision,
          handle,
          preview: true,
          renderers,
          onExposure: async () => {
            exposures += 1;
          },
          onDismiss: async () => {
            dismissals += 1;
          },
        }),
      ),
    );
  }
  function input() {
    const element = container.querySelector("input");
    assert(element instanceof HTMLInputElement, "Modal input is missing");
    return element;
  }
  function assertInitialFocus() {
    assert(
      document.activeElement === container.querySelector("button"),
      "Close must receive initial focus",
    );
  }
  try {
    for (const closing of ["button", "Escape"] as const) {
      opener.focus();
      render(initial);
      assertInitialFocus();
      await observe(`${closing}: initial Close focus`);
      const field = input();
      field.focus();
      field.value = "edited label";
      field.setSelectionRange(2, 5);
      render(initial);
      assert(document.activeElement === field, "Same-reference rerender stole input focus");
      render({ ...initial });
      assert(input() === field, "Same-decision rerender replaced input");
      assert(document.activeElement === field, "Same-decision rerender stole input focus");
      assert(field.value === "edited label", "Rerender lost the edited value");
      assert(
        field.selectionStart === 2 && field.selectionEnd === 5,
        "Rerender lost input selection",
      );
      await observe(`${closing}: cloned decision preserves input focus and selection`);
      flushSync(() => {
        if (closing === "button") container.querySelector("button")?.click();
        else field.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
      assert(!container.querySelector('[role="dialog"]'), "Close did not remove the modal");
      assert(
        document.activeElement === opener,
        "Close did not return focus to the original opener",
      );
      await observe(`${closing}: closed with opener focus restored`);
      render({ ...initial });
      assert(
        !container.querySelector('[role="dialog"]'),
        "Same decision reopened a dismissed modal",
      );
      render(null);
    }

    opener.focus();
    render(initial);
    const previous = input();
    previous.focus();
    render({ ...initial, decisionId: "preview-2" });
    assert(input() !== previous, "New decision did not create a fresh display");
    assertInitialFocus();
    await observe("New decision receives initial Close focus");
    input().focus();
    render(null);
    assert(document.activeElement === opener, "Unmount did not restore the original opener");
    await observe("Unmount restores opener focus");

    opener.focus();
    render({ ...initial, renderer: "banner" });
    assert(document.activeElement === opener, "Banner stole focus");
    render(initial);
    assertInitialFocus();
    input().focus();
    render({ ...initial, renderer: "banner" });
    assert(document.activeElement === opener, "Leaving modal did not restore opener focus");
    await observe("Renderer transition restores opener focus");
    assert(exposures === 0 && dismissals === 0, "Preview recorded a receipt");
  } finally {
    flushSync(() => root.unmount());
  }
}
