import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { RewardAccount, RewardGrant } from "@croco/gamification-core";

export type RewardViewState<T> =
  | { readonly kind: "loading" | "empty" }
  | { readonly kind: "denied" | "error"; readonly message: string; readonly reload?: () => void }
  | { readonly kind: "partial" | "ready"; readonly value: T; readonly message?: string };

function unavailable<T>(state: RewardViewState<T>): ReactElement | null {
  if (state.kind === "loading")
    return h("p", { role: "status", "aria-busy": true }, "Loading rewards…");
  if (state.kind === "empty") return h("p", null, "No rewards yet.");
  if (state.kind === "error" || state.kind === "denied")
    return h(
      "div",
      { role: "alert" },
      state.message,
      state.reload ? h("button", { type: "button", onClick: state.reload }, "Reload status") : null,
    );
  return null;
}

export function BadgeShelf({
  state,
}: {
  readonly state: RewardViewState<RewardAccount>;
}): ReactElement {
  if (state.kind !== "ready" && state.kind !== "partial")
    return h("section", { "aria-label": "Your rewards" }, unavailable(state));
  return h(
    "section",
    { "aria-label": "Your rewards" },
    h("h2", null, "Your rewards"),
    state.kind === "partial"
      ? h("p", { role: "status" }, state.message ?? "Some reward records are unavailable.")
      : null,
    h(
      "p",
      null,
      `${state.value.points.reduce((sum, item) => sum + BigInt(item.amount), BigInt(0))} achievement points`,
    ),
    state.value.badges.length
      ? h(
          "ul",
          null,
          ...state.value.badges.map((badge) => h("li", { key: badge.badgeId }, badge.title)),
        )
      : h("p", null, "No badges earned yet."),
  );
}

export function RewardReceipt({
  state,
}: {
  readonly state: RewardViewState<RewardGrant>;
}): ReactElement {
  if (state.kind !== "ready" && state.kind !== "partial")
    return h("section", { "aria-label": "Reward receipt" }, unavailable(state));
  const grant = state.value;
  const entry = grant.selection.entry;
  return h(
    "section",
    { "aria-label": "Reward receipt" },
    h("h2", null, "Reward receipt"),
    h("p", null, "Achievement rewards cannot be transferred or redeemed for money."),
    state.kind === "partial"
      ? h("p", { role: "status" }, state.message ?? "Receipt details are incomplete.")
      : null,
    h(
      "p",
      { role: "status" },
      grant.state === "indeterminate"
        ? "Outcome unresolved. Contact support with this receipt; do not submit another grant."
        : grant.state === "reserved"
          ? "Reward selected; settlement pending."
          : grant.state === "rejected"
            ? `No reward granted: ${grant.rejection}.`
            : "Reward granted",
    ),
    h(
      "p",
      null,
      entry
        ? `${entry.title} (${entry.kind}${entry.kind === "points" ? `: ${entry.amount} achievement points` : ""})`
        : "No reward",
    ),
    h(
      "dl",
      null,
      h("dt", null, "Receipt"),
      h("dd", null, grant.id),
      h("dt", null, "Policy version"),
      h("dd", null, grant.policyVersion),
      h("dt", null, "Scope"),
      h(
        "dd",
        null,
        `${grant.scope.appId} / ${grant.scope.environmentId} / ${grant.scope.tenantId}`,
      ),
      h("dt", null, "Weights"),
      h("dd", null, grant.selection.receipt.weights.join(" : ") || "Fixed selection"),
      h("dt", null, "Fallback policy"),
      h(
        "dd",
        null,
        grant.selection.receipt.fallbackPolicy.kind === "fixed"
          ? `${grant.selection.receipt.fallbackPolicy.entry.title}, cap ${grant.selection.receipt.fallbackPolicy.cap}`
          : "No reward",
      ),
      h("dt", null, "Selection"),
      h("dd", null, grant.selection.receipt.mode),
      h("dt", null, "Budget fallback"),
      h("dd", null, grant.selection.receipt.fallback ? "Applied" : "Not applied"),
    ),
  );
}
