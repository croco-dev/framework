import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { MissionProgress } from "@croco/gamification-core";

export type MissionProgressState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "denied" | "error"; message: string; retry?: () => void }>
  | Readonly<{ kind: "partial" | "ready"; progress: MissionProgress; message?: string }>;
export type ProgressCardProps = Readonly<{ state: MissionProgressState }>;

function unavailable(state: MissionProgressState): ReactElement | null {
  if (state.kind === "loading") return h("p", { "aria-busy": true }, "Loading mission progress…");
  if (state.kind === "empty") return h("p", null, "No mission period started");
  if (state.kind === "denied" || state.kind === "error")
    return h(
      "div",
      { role: "alert" },
      h("p", null, state.message),
      state.retry ? h("button", { type: "button", onClick: state.retry }, "Try again") : null,
    );
  return null;
}

export function ProgressCard({ state }: ProgressCardProps): ReactElement {
  if (state.kind !== "ready" && state.kind !== "partial")
    return h("section", { "aria-label": "Mission progress" }, unavailable(state));
  const { definition, instance, key, remaining } = state.progress;
  return h(
    "section",
    { "aria-label": "Mission progress", "aria-busy": state.kind === "partial" },
    h("h2", null, "Your mission"),
    h("p", null, `${definition.actionId} · ${definition.period} · ${definition.timezone}`),
    h("p", null, `Version ${key.version} · Episode ${key.episodeId}`),
    h(
      "p",
      null,
      state.kind === "partial"
        ? `Last confirmed: ${instance.state === "achieved" ? "Mission achieved" : instance.state === "closed" ? "Period closed" : "In progress"}`
        : instance.state === "achieved"
          ? "Mission achieved"
          : instance.state === "closed"
            ? "Period closed"
            : "In progress",
    ),
    h("progress", {
      "aria-label": "Mission progress",
      value: Math.min(instance.progress, definition.target),
      max: definition.target,
    }),
    h("p", null, `${instance.progress} of ${definition.target} · ${remaining} remaining`),
    state.kind === "partial"
      ? h("p", { role: "status" }, state.message ?? "Some progress is unavailable")
      : null,
  );
}

export function StreakCalendar({ state }: ProgressCardProps): ReactElement {
  if (state.kind !== "ready" && state.kind !== "partial")
    return h("section", { "aria-label": "Activity calendar" }, unavailable(state));
  const { instance, definition } = state.progress;
  return h(
    "section",
    { "aria-label": "Activity calendar", "aria-busy": state.kind === "partial" },
    h("h2", null, "Activity calendar"),
    h("p", null, `${instance.startDate} to ${instance.endDate} · ${definition.timezone}`),
    instance.activityDates.length === 0
      ? h("p", null, "No confirmed activity in this period")
      : h(
          "ul",
          null,
          ...instance.activityDates.map((date) =>
            h("li", { key: date }, h("time", { dateTime: date }, date)),
          ),
        ),
    state.kind === "partial" ? h("p", null, state.message ?? "Some activity is unavailable") : null,
  );
}

export function AchievementToast({ state }: ProgressCardProps): ReactElement | null {
  if (
    state.kind !== "ready" ||
    state.progress.instance.state !== "achieved" ||
    !state.progress.instance.completion
  )
    return null;
  return h(
    "aside",
    { role: "status", "aria-live": "polite" },
    `Mission achieved · ${state.progress.instance.completion.achievedAt}`,
  );
}
