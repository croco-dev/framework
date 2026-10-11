import { createElement as h, useRef, useState } from "react";
import type { ReactElement } from "react";
import type { ResolvedCandidate, SavedIntent, SavedIntentPage } from "@croco/experience-core";

export type SavedItemsState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; message: string }>
  | Readonly<{ kind: "ready" | "partial"; page: SavedIntentPage }>;
export type ContinueCardProps = Readonly<{
  candidate: ResolvedCandidate;
  /** Must call the authenticated server resolve endpoint immediately before navigation. */
  onContinue(intent: SavedIntent): Promise<void>;
  onRemove(intent: SavedIntent): Promise<void>;
  onComplete(intent: SavedIntent): Promise<void>;
  onPin(intent: SavedIntent, pinOrder: number | null): Promise<void>;
  onReload(): Promise<void>;
}>;
export type SavedItemsProps = Omit<ContinueCardProps, "candidate"> &
  Readonly<{
    state: SavedItemsState;
    onNextPage(offset: number): Promise<void>;
  }>;

/** Uses buttons so a previously resolved URL cannot bypass the server's current permission check. */
export function ContinueCard(props: ContinueCardProps): ReactElement {
  const { candidate } = props;
  const { intent } = candidate;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const available = candidate.availability === "available";
  const button = (label: string, action: () => Promise<void>, disabled = false) =>
    h(
      "button",
      { type: "button", disabled: pending || disabled, onClick: () => void run(action) },
      label,
    );
  return h(
    "article",
    { "aria-busy": pending, "data-state": candidate.availability },
    h("h3", null, available ? candidate.label : "Unavailable item"),
    h(
      "p",
      null,
      `${intent.sourceKind === "explicit" ? "Saved" : "Recent work"} · ${candidate.rankReason === "pinned" ? "Pinned" : "Recently used"}`,
    ),
    !available ? h("p", { role: "status" }, `Unavailable: ${candidate.availability}`) : null,
    button("Continue", () => props.onContinue(intent), !available || failed),
    button("Mark completed", () => props.onComplete(intent), !available || failed),
    button(
      intent.pinOrder === undefined ? "Pin" : "Unpin",
      () => props.onPin(intent, intent.pinOrder === undefined ? 0 : null),
      !available || failed,
    ),
    button("Remove", () => props.onRemove(intent), failed),
    pending ? h("p", { role: "status" }, "Saving or checking access…") : null,
    failed
      ? h(
          "div",
          { role: "alert" },
          h(
            "p",
            null,
            "The action failed. Reload to check current access and revision before trying again.",
          ),
          button("Reload saved items", props.onReload),
        )
      : null,
  );
}

/** Renders one bounded server page in the order selected by the shared policy service. */
export function SavedItems(props: SavedItemsProps): ReactElement {
  const { state } = props;
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const inFlight = useRef(false);
  const run = async (action: () => Promise<void>): Promise<void> => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setFailed(false);
    try {
      await action();
    } catch {
      setFailed(true);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  };
  const reload = h(
    "button",
    { type: "button", disabled: pending, onClick: () => void run(props.onReload) },
    "Reload saved items",
  );
  let content: ReactElement;
  switch (state.kind) {
    case "loading":
      content = h("p", { role: "status" }, "Loading saved items…");
      break;
    case "empty":
      content = h("p", { role: "status" }, "No saved items.");
      break;
    case "denied":
      content = h("div", { role: "alert" }, h("p", null, state.message), reload);
      break;
    case "error":
      content = h("div", { role: "alert" }, h("p", null, state.message), reload);
      break;
    case "ready":
    case "partial":
      content = h(
        "div",
        null,
        state.kind === "partial" ? h("p", { role: "status" }, "Some items are unavailable.") : null,
        h(
          "ul",
          null,
          state.page.candidates.map((candidate) =>
            h(
              "li",
              { key: `${candidate.intent.id}:${candidate.intent.revision}` },
              h(ContinueCard, { ...props, candidate }),
            ),
          ),
        ),
        state.page.nextOffset !== undefined
          ? h(
              "button",
              {
                type: "button",
                disabled: pending,
                onClick: () => void run(() => props.onNextPage(state.page.nextOffset as number)),
              },
              "Next page",
            )
          : null,
        reload,
      );
      break;
  }
  return h(
    "section",
    {
      "aria-label": "Saved items",
      "aria-busy": pending || state.kind === "loading",
      "data-state": state.kind,
    },
    h("h2", null, "Saved items"),
    content,
    pending ? h("p", { role: "status" }, "Loading saved items…") : null,
    failed ? h("p", { role: "alert" }, "Could not load saved items. Try reloading.") : null,
  );
}
