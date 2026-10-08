import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { assertChallengeOperationsAudit, loadChallengeOperations } from "@croco/admin-core";
import type {
  ChallengeOperationsDefinition,
  ChallengeOperationsSource,
  ChallengeOperationsState,
} from "@croco/admin-core";

export type ChallengeConsoleProps = {
  scopeKey: string;
  actor: string;
  permissions: readonly string[];
  source: ChallengeOperationsSource;
  initialDefinition: ChallengeOperationsDefinition;
};
export function ChallengeConsole(props: ChallengeConsoleProps): ReactElement {
  const definition = props.initialDefinition;
  const identity = JSON.stringify([
    props.scopeKey,
    props.actor,
    [...props.permissions].sort(),
    definition.scope.app,
    definition.scope.environment,
    definition.scope.tenantId,
    definition.id,
    definition.version,
    definition.start,
    definition.end,
    definition.goal,
    definition.memberCap,
    definition.minMembers,
    definition.lateAllowanceMs,
    definition.visibility,
    definition.leavePolicy,
  ]);
  const [session, setSession] = useState({ source: props.source, identity, revision: 0 });
  if (session.source !== props.source || session.identity !== identity) {
    setSession({ source: props.source, identity, revision: session.revision + 1 });
  }
  return <Console key={session.revision} {...props} />;
}
function Console({
  source,
  actor,
  permissions,
  initialDefinition,
}: ChallengeConsoleProps): ReactElement {
  const [state, setState] = useState<ChallengeOperationsState>({ kind: "loading" });
  const [definition, setDefinition] = useState(initialDefinition);
  const initial = useRef(initialDefinition);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const busy = useRef(false);
  const canRead = permissions.includes("challenge.read");
  const permissionKey = [...permissions].sort().join("|");
  const identity = `${actor}:${permissionKey}`;
  const latest = useRef({ source, identity });
  latest.current = { source, identity };
  const apply = (next: ChallengeOperationsState) => {
    setState(next);
    if (next.kind === "ready" || next.kind === "partial") setDefinition(next.view.challenge);
    else if (next.kind === "empty") setDefinition(initial.current);
  };
  useEffect(() => {
    const current = ++generation.current;
    busy.current = false;
    setPending(false);
    setError(undefined);
    setReason("");
    setState({ kind: "loading" });
    void loadChallengeOperations(source, permissionKey.split("|")).then(
      (next) => {
        if (
          generation.current === current &&
          latest.current.source === source &&
          latest.current.identity === identity
        )
          apply(next);
      },
      () => {
        if (
          generation.current === current &&
          latest.current.source === source &&
          latest.current.identity === identity
        )
          setState({ kind: "error", message: "Unable to load challenge operations." });
      },
    );
    return () => {
      generation.current = current + 1;
    };
  }, [source, identity, permissionKey]);
  const run = async (operation: () => Promise<ChallengeOperationsState>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const current = generation.current;
    const isCurrent = () =>
      generation.current === current &&
      latest.current.source === source &&
      latest.current.identity === identity;
    try {
      const next = await operation();
      if (isCurrent()) {
        apply(next);
        setError(undefined);
      }
    } catch {
      if (isCurrent())
        setError("Operation failed. Reload the current revision before trying again.");
    } finally {
      if (isCurrent()) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const view = state.kind === "ready" || state.kind === "partial" ? state.view : undefined;
  const editable =
    canRead &&
    permissions.includes("challenge.write") &&
    (!view || view.pendingEvidenceCount === 0) &&
    (state.kind === "empty" || (state.kind === "ready" && view?.challenge.state === "scheduled"));
  const enabled = !pending && !error && actor.trim().length > 0 && reason.trim().length > 0;
  if (!canRead)
    return (
      <section aria-label="Challenge console">
        <h2>Challenge console</h2>
        <p role="alert">Challenge read permission is required.</p>
      </section>
    );
  return (
    <section aria-label="Challenge console" aria-busy={pending || state.kind === "loading"}>
      <h2>Challenge console</h2>
      {state.kind === "loading" && <p role="status">Loading challenge operations…</p>}
      {state.kind === "empty" && <p>No challenge policy exists.</p>}
      {(state.kind === "error" || state.kind === "denied") && <p role="alert">{state.message}</p>}
      {state.kind === "partial" && (
        <p role="alert">
          {state.message ?? "Progress is incomplete. Reload before making changes."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || state.kind === "loading"}
        onClick={() => void run(() => loadChallengeOperations(source, permissions))}
      >
        Reload operations
      </button>
      {view && view.pendingEvidenceCount > 0 && (
        <p role="alert">
          {view.pendingEvidenceCount} evidence verification(s) unresolved. Totals include only
          verified contributions. Retry source verification, then reload. Unresolved evidence is not
          zero contribution; finalization is blocked.
        </p>
      )}
      {view && (
        <p role="status">
          {view.challenge.state} · revision {view.challenge.version} · Group total{" "}
          {view.challenge.progress} / {view.challenge.goal} · Participants{" "}
          {view.challenge.memberCount}
        </p>
      )}
      {(view || state.kind === "empty") && (
        <>
          <p>
            Rules are immutable once the challenge starts. Finalization occurs after the end and
            late evidence allowance.
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              if (!editable || !enabled) return;
              void run(async () => {
                const audit = { actor, reason, idempotencyKey: crypto.randomUUID() };
                assertChallengeOperationsAudit(audit);
                return source.save(
                  view
                    ? {
                        ...audit,
                        kind: "update",
                        expectedVersion: view.challenge.version,
                        definition: { ...definition, version: view.challenge.version + 1 },
                      }
                    : { ...audit, kind: "create", definition },
                );
              });
            }}
          >
            <fieldset disabled={!editable || pending || Boolean(error)}>
              <legend>Challenge policy</legend>
              <p>
                {definition.scope.app} / {definition.scope.environment} /{" "}
                {definition.scope.tenantId} · {definition.id}
              </p>
              {(["start", "end"] as const).map((field) => (
                <label key={field}>
                  {field === "start" ? "Start (UTC)" : "End (UTC)"}
                  <input
                    aria-label={field === "start" ? "Start (UTC)" : "End (UTC)"}
                    type="datetime-local"
                    required
                    value={
                      Number.isFinite(definition[field].getTime())
                        ? definition[field].toISOString().slice(0, 16)
                        : ""
                    }
                    onChange={(event) =>
                      setDefinition({ ...definition, [field]: new Date(`${event.target.value}Z`) })
                    }
                  />
                </label>
              ))}
              {(["goal", "memberCap", "minMembers", "lateAllowanceMs"] as const).map((field) => (
                <label key={field}>
                  {
                    {
                      goal: "Group goal",
                      memberCap: "Per-member cap (blank for none)",
                      minMembers: "Minimum participants",
                      lateAllowanceMs: "Late allowance (milliseconds)",
                    }[field]
                  }
                  <input
                    type="number"
                    min={field === "lateAllowanceMs" ? 0 : 1}
                    step="1"
                    required={field !== "memberCap"}
                    value={definition[field] ?? ""}
                    onChange={(event) =>
                      setDefinition({
                        ...definition,
                        [field]:
                          field === "memberCap" && event.target.value === ""
                            ? null
                            : event.target.valueAsNumber,
                      })
                    }
                  />
                </label>
              ))}
              <label>
                Leave policy
                <select
                  value={definition.leavePolicy}
                  onChange={(event) =>
                    setDefinition({
                      ...definition,
                      leavePolicy: event.target.value === "remove" ? "remove" : "retain",
                    })
                  }
                >
                  <option value="retain">Retain accepted contribution</option>
                  <option value="remove">Remove accepted contribution before finalization</option>
                </select>
              </label>
              <label>
                Visibility
                <select
                  value={definition.visibility}
                  onChange={(event) =>
                    setDefinition({
                      ...definition,
                      visibility: event.target.value === "consented" ? "consented" : "aggregate",
                    })
                  }
                >
                  <option value="aggregate">Group aggregate only</option>
                  <option value="consented">Optional participant consent</option>
                </select>
              </label>
              <button type="submit" disabled={!enabled}>
                {view ? "Save policy" : "Create challenge"}
              </button>
            </fieldset>
          </form>
          <label>
            Change reason
            <input
              value={reason}
              disabled={pending || Boolean(error) || state.kind === "partial"}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          {view && (
            <button
              type="button"
              disabled={
                !enabled ||
                state.kind !== "ready" ||
                view.pendingEvidenceCount !== 0 ||
                !permissions.includes("challenge.close") ||
                !["active", "closing"].includes(view.challenge.state)
              }
              onClick={() => {
                if (
                  !enabled ||
                  state.kind !== "ready" ||
                  view.pendingEvidenceCount !== 0 ||
                  !permissions.includes("challenge.close")
                )
                  return;
                void run(async () => {
                  const request = {
                    actor,
                    reason,
                    idempotencyKey: crypto.randomUUID(),
                    expectedVersion: view.challenge.version,
                  };
                  assertChallengeOperationsAudit(request);
                  return source.close(request);
                });
              }}
            >
              Finalize challenge
            </button>
          )}
        </>
      )}
    </section>
  );
}
