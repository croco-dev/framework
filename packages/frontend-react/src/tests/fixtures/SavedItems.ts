import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { SavedItems } from "../../libs/SavedItems";
import type { SavedItemsState } from "../../libs/SavedItems";
import type { ResolvedCandidate } from "@croco/experience-core";

/** Browser-only synthetic fixtures; never part of published entrypoints. */
export function mountSavedItemsFixture(
  element: HTMLElement,
  kind: SavedItemsState["kind"] | "action-error",
): void {
  const candidate: ResolvedCandidate = {
    intent: {
      id: "fixture-report",
      resourceType: "report",
      resourceId: "fixture",
      sourceKind: "explicit",
      scope: { appId: "fixture", environment: "test", tenantId: "fixture" },
      subject: { kind: "customer", id: "synthetic" },
      state: "saved",
      revision: 1,
      savedAt: "2026-10-01T00:00:00Z",
      updatedAt: "2026-10-01T00:00:00Z",
      lastUsedAt: "2026-10-01T00:00:00Z",
    },
    availability: "available",
    label: "Synthetic report",
    rankReason: "recent",
  };
  const initial: SavedItemsState =
    kind === "ready" || kind === "action-error" || kind === "partial"
      ? {
          kind: kind === "partial" ? "partial" : "ready",
          page: {
            candidates:
              kind === "partial"
                ? [
                    candidate,
                    {
                      ...candidate,
                      intent: { ...candidate.intent, id: "unavailable-report" },
                      availability: "denied",
                      label: "Must be masked",
                    },
                  ]
                : [candidate],
            exclusions: [],
            nextOffset: 2,
          },
        }
      : kind === "denied" || kind === "error"
        ? { kind, message: "Synthetic access or storage failure." }
        : { kind };
  function Fixture() {
    const [state, setState] = useState(initial);
    const [message, setMessage] = useState("");
    const action = async () => {
      if (kind === "action-error") throw new Error("Synthetic mutation failure");
      setState({ kind: "empty" });
    };
    return h(
      "main",
      null,
      h(SavedItems, {
        state,
        onReload: async () => {
          setState({
            kind: "ready",
            page: {
              candidates: [{ ...candidate, intent: { ...candidate.intent, revision: 2 } }],
              exclusions: [],
            },
          });
        },
        onContinue: async (intent) => {
          setMessage(`Server recheck requested at revision ${intent.revision}`);
        },
        onRemove: action,
        onComplete: action,
        onPin: async (intent, pinOrder) => {
          setState({
            kind: "ready",
            page: {
              candidates: [
                {
                  ...candidate,
                  intent: {
                    ...intent,
                    revision: intent.revision + 1,
                    pinOrder: pinOrder ?? undefined,
                  },
                  rankReason: pinOrder === null ? "recent" : "pinned",
                },
              ],
              exclusions: [],
            },
          });
        },
        onNextPage: async () => {
          setState({ kind: "empty" });
        },
      }),
      h("p", { role: "status" }, message),
    );
  }
  createRoot(element).render(h(Fixture));
}
