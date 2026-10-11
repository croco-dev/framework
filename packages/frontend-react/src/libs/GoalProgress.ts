import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { GoalEpisode, GoalProgress as GoalProgressResult } from "@croco/onboarding-core";

export type GoalProgressState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "denied"; message: string; retry?: () => void }>
  | Readonly<{ kind: "error"; message: string; retry?: () => void }>
  | Readonly<{ kind: "partial"; progress: GoalProgressResult; message?: string }>
  | Readonly<{ kind: "ready"; progress: GoalProgressResult; message?: string }>;

export type GoalProgressProps = Readonly<{ state: GoalProgressState }>;

const STATUS_LABEL: Record<GoalEpisode["status"], string> = {
  in_progress: "In progress",
  closing: "Checking recent activity",
  achieved: "Goal achieved",
  expired: "Goal ended",
  canceled: "Goal canceled",
};

export function GoalProgress({ state }: GoalProgressProps): ReactElement {
  if (state.kind === "loading")
    return h("section", { "aria-busy": true }, "Loading goal progress…");
  if (state.kind === "empty") return h("section", null, "No active goal");
  if (state.kind === "denied" || state.kind === "error") {
    return h(
      "section",
      { role: "alert" },
      h("p", null, state.message),
      state.retry ? h("button", { type: "button", onClick: state.retry }, "Try again") : null,
    );
  }

  const { title, status, progress, threshold } = state.progress;
  return h(
    "section",
    { "aria-label": title ?? "Goal progress", "aria-busy": state.kind === "partial" },
    h("h2", null, title ?? "Goal progress"),
    h("p", null, STATUS_LABEL[status]),
    h("progress", { value: Math.min(progress, threshold), max: threshold }),
    h("p", null, `${progress} of ${threshold}`),
    state.message ? h("p", null, state.message) : null,
  );
}

export type NextActionCardProps = Readonly<{ progress: GoalProgressResult }>;

export function NextActionCard({ progress }: NextActionCardProps): ReactElement | null {
  const { nextActionHref: href, description, status } = progress;
  if (!href || status !== "in_progress") return null;
  return h(
    "aside",
    { "aria-label": "Next action" },
    h("h3", null, "Next action"),
    description ? h("p", null, description) : null,
    h("a", { href }, "Continue"),
  );
}
