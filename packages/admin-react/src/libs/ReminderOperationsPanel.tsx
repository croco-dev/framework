import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { assertReminderOperatorCancel, loadReminderOperations } from "@croco/admin-core";
import type {
  ReminderOperationsSource,
  ReminderOperationsState,
  ReminderOperationsRow,
} from "@croco/admin-core";

export type ReminderOperationsPanelProps = {
  scopeKey: string;
  actor: string;
  permissions: readonly string[];
  source: ReminderOperationsSource;
};
export function ReminderOperationsPanel(props: ReminderOperationsPanelProps): ReactElement {
  return <Panel key={props.scopeKey} {...props} />;
}
function Panel({ actor, permissions, source }: ReminderOperationsPanelProps): ReactElement {
  const [state, setState] = useState<ReminderOperationsState>({ kind: "loading" });
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentSource = useRef(source);
  currentSource.current = source;
  const canRead = permissions.includes("reminder.read");
  const currentRead = useRef(canRead);
  currentRead.current = canRead;
  useEffect(() => {
    mounted.current = true;
    busy.current = false;
    setPending(false);
    setState({ kind: "loading" });
    setError(undefined);
    let current = true;
    void loadReminderOperations(source, canRead ? ["reminder.read"] : []).then(
      (next) => {
        if (current) setState(next);
      },
      () => {
        if (current) setState({ kind: "error", message: "Unable to load reminder operations." });
      },
    );
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [source, canRead]);
  const run = async (operation: () => Promise<ReminderOperationsState>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      const next = await operation();
      if (mounted.current && currentSource.current === source && currentRead.current === canRead)
        setState(next);
    } catch {
      if (mounted.current && currentSource.current === source && currentRead.current === canRead)
        setError("Operation failed. Reload the current reminder version before retrying.");
    } finally {
      if (mounted.current && currentSource.current === source && currentRead.current === canRead) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const cancel = (row: ReminderOperationsRow) => {
    if (!permissions.includes("reminder.cancel") || state.kind !== "ready" || error) return;
    void run(async () => {
      const request = {
        scope: row.reminder.scope,
        subject: row.reminder.subject,
        id: row.reminder.id,
        expectedVersion: row.reminder.version,
        actor,
        reason,
        idempotencyKey: crypto.randomUUID(),
      };
      assertReminderOperatorCancel(request);
      return source.cancel(request);
    });
  };
  return (
    <section aria-label="Reminder operations" aria-busy={pending || state.kind === "loading"}>
      <h2>Reminder operations</h2>
      {state.kind === "loading" && <p role="status">Loading reminder operations…</p>}
      {state.kind === "empty" && <p>No reminders.</p>}
      {(state.kind === "error" || state.kind === "denied") && <p role="alert">{state.message}</p>}
      {state.kind === "partial" && (
        <p role="alert">
          {state.message ?? "Incomplete occurrence history. Reload before canceling."}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || state.kind === "loading"}
        onClick={() => void run(() => loadReminderOperations(source, permissions))}
      >
        Reload operations
      </button>
      {(state.kind === "ready" || state.kind === "partial") && (
        <>
          <p>
            Operators may cancel reminders. Only the owner can create or change a schedule. Already
            accepted messages cannot be recalled.
          </p>
          {permissions.includes("reminder.cancel") && (
            <label>
              Cancellation reason
              <input
                aria-label="Cancellation reason"
                value={reason}
                disabled={pending || Boolean(error)}
                onChange={(event) => setReason(event.target.value)}
              />
            </label>
          )}
          {state.rows.map((row) => (
            <article key={row.reminder.id}>
              <h3>{row.reminder.id}</h3>
              <p>
                {row.reminder.state} · {row.reminder.timezone} · version {row.reminder.version}
              </p>
              <p>
                Next local: {row.nextLocalTime ?? "None"} · Next UTC:{" "}
                {row.reminder.nextScheduledAt?.toISOString() ?? "None"}
              </p>
              <ul aria-label="Occurrence outcomes">
                {row.occurrences.map((occurrence) => (
                  <li key={occurrence.id}>
                    {occurrence.scheduledAt.toISOString()} · {occurrence.state}
                    {occurrence.reason ? ` · ${occurrence.reason}` : ""}
                  </li>
                ))}
              </ul>
              {permissions.includes("reminder.cancel") && row.reminder.state !== "canceled" && (
                <button
                  type="button"
                  disabled={
                    pending ||
                    state.kind !== "ready" ||
                    !reason.trim() ||
                    !actor.trim() ||
                    Boolean(error)
                  }
                  onClick={() => cancel(row)}
                >
                  Cancel {row.reminder.id}
                </button>
              )}
            </article>
          ))}
        </>
      )}
    </section>
  );
}
