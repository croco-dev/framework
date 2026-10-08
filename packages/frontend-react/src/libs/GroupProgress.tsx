import type { ReactElement } from "react";

export type GroupProgressView = Readonly<{
  challenge: Readonly<{
    id: string;
    version: number;
    start: Date;
    end: Date;
    goal: number;
    memberCap: number | null;
    minMembers: number;
    lateAllowanceMs: number;
    visibility: "aggregate" | "consented";
    leavePolicy: "retain" | "remove";
    state: "scheduled" | "active" | "closing" | "completed" | "expired";
    progress: number;
    memberCount: number;
  }>;
  self: Readonly<{
    intervals: readonly Readonly<{ joinedAt: Date; leftAt: Date | null }>[];
  }> | null;
  selfProgress: number;
  pendingEvidenceCount: number;
}>;
export type GroupProgressState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; message: string }
  | { kind: "ready" | "partial"; view: GroupProgressView; message?: string };
export type GroupProgressProps = { state: GroupProgressState };
export function GroupProgress({ state }: GroupProgressProps): ReactElement {
  const view = state.kind === "ready" || state.kind === "partial" ? state.view : undefined;
  return (
    <section aria-label="Group progress">
      <h2>Group progress</h2>
      {state.kind === "loading" && <p role="status">Loading challenge…</p>}
      {state.kind === "empty" && <p>No challenge is available.</p>}
      {(state.kind === "error" || state.kind === "denied") && <p role="alert">{state.message}</p>}
      {state.kind === "partial" && (
        <p role="alert">
          {state.message ?? "Progress is incomplete. Reload before making changes."}
        </p>
      )}
      {view && (
        <>
          {view.pendingEvidenceCount > 0 && (
            <p role="alert">
              {view.pendingEvidenceCount} evidence verification(s) unresolved. These totals contain
              only verified contributions. Retry source verification, then reload; unresolved
              evidence is not zero contribution and blocks finalization.
            </p>
          )}
          <p role="status">
            {view.challenge.state} · Group total: {view.challenge.progress} / {view.challenge.goal}
          </p>
          <progress
            aria-label="Group goal"
            value={Math.min(view.challenge.progress, view.challenge.goal)}
            max={view.challenge.goal}
          />
          <p>
            Your contribution: {view.selfProgress}. Participants: {view.challenge.memberCount} /
            minimum {view.challenge.minMembers}.
          </p>
          <p>
            Per-member cap: {view.challenge.memberCap ?? "None"}. Shared progress does not determine
            individual eligibility or rewards.
          </p>
          <p>
            Period: {view.challenge.start.toISOString()} (inclusive) to{" "}
            {view.challenge.end.toISOString()} (exclusive).
          </p>
          <p>
            Late evidence allowance: {view.challenge.lateAllowanceMs} milliseconds. The result is
            final only after this allowance ends.
          </p>
        </>
      )}
    </section>
  );
}
