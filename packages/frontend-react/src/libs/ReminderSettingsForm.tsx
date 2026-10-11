import { useEffect, useId, useRef, useState } from "react";
import type { ReactElement } from "react";

export type ReminderSettingsInput = Readonly<{
  topic: string;
  resourceRef: string;
  timezone: string;
  schedule: Readonly<{ localTime: string; weekdays: readonly number[] }>;
  channel: "email" | "push" | "sms" | "inApp";
  lateDeliveryMs: number;
}>;
export type ReminderSettingsView = Readonly<{
  reminder: ReminderSettingsInput &
    Readonly<{
      id: string;
      version: number;
      state: "active" | "snoozed" | "canceled";
      nextScheduledAt: Date | null;
    }>;
  nextLocalTime: string | null;
}>;
export type ReminderSettingsState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; message: string }
  | { kind: "ready" | "partial"; view: ReminderSettingsView; message?: string };
export type ReminderSettingsRevision = {
  id: string;
  expectedVersion: number;
  idempotencyKey: string;
};
export type ReminderSettingsSave = { input: ReminderSettingsInput; idempotencyKey: string } & (
  | { kind: "create" }
  | { kind: "update"; id: string; expectedVersion: number }
);
export interface ReminderSettingsSource {
  load(): Promise<ReminderSettingsState>;
  preview(input: ReminderSettingsInput): Promise<{ nextScheduledAt: Date; localTime: string }>;
  save(request: ReminderSettingsSave): Promise<ReminderSettingsView>;
  snooze(request: ReminderSettingsRevision & { until: Date }): Promise<ReminderSettingsView>;
  cancel(request: ReminderSettingsRevision): Promise<ReminderSettingsView>;
}
export type ReminderSettingsFormProps = {
  scopeKey: string;
  channels: readonly ReminderSettingsInput["channel"][];
  source: ReminderSettingsSource;
  initialInput: ReminderSettingsInput;
};
export type SnoozeControlProps = { disabled: boolean; onSnooze(until: Date): Promise<void> };

export function SnoozeControl({ disabled, onSnooze }: SnoozeControlProps): ReactElement {
  const id = useId();
  const [until, setUntil] = useState("");
  const valid = Number.isFinite(Date.parse(until));
  return (
    <div>
      <label htmlFor={id}>Snooze until (UTC ISO timestamp)</label>
      <input
        id={id}
        value={until}
        disabled={disabled}
        placeholder="2026-10-06T09:00:00Z"
        onChange={(event) => setUntil(event.target.value)}
      />
      <p>Snooze moves the next occurrence once. The recurring schedule resumes afterward.</p>
      <button
        type="button"
        disabled={disabled || !valid || !until.endsWith("Z")}
        onClick={() => void onSnooze(new Date(until))}
      >
        Snooze once
      </button>
    </div>
  );
}

export function ReminderSettingsForm(props: ReminderSettingsFormProps): ReactElement {
  return <ReminderEditor key={props.scopeKey} {...props} />;
}
function ReminderEditor({
  source,
  initialInput,
  channels,
}: ReminderSettingsFormProps): ReactElement {
  const [state, setState] = useState<ReminderSettingsState>({ kind: "loading" });
  const [input, setInput] = useState(initialInput);
  const [preview, setPreview] = useState<{ nextScheduledAt: Date; localTime: string }>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const busy = useRef(false);
  const mounted = useRef(true);
  const currentSource = useRef(source);
  currentSource.current = source;
  const prefix = useId();
  const apply = (next: ReminderSettingsState) => {
    setState(next);
    setPreview(undefined);
    if (next.kind === "ready" || next.kind === "partial") setInput(next.view.reminder);
  };
  useEffect(() => {
    mounted.current = true;
    busy.current = false;
    setPending(false);
    setState({ kind: "loading" });
    setPreview(undefined);
    setError(undefined);
    let current = true;
    void source.load().then(
      (next) => {
        if (current) apply(next);
      },
      () => {
        if (current) setState({ kind: "error", message: "Unable to load reminders." });
      },
    );
    return () => {
      current = false;
      mounted.current = false;
    };
  }, [source]);
  const run = async (operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    try {
      await operation();
    } catch {
      if (mounted.current && currentSource.current === source)
        setError("Reminder operation failed. Reload the current version before trying again.");
    } finally {
      if (mounted.current && currentSource.current === source) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const view = state.kind === "ready" || state.kind === "partial" ? state.view : undefined;
  const change = (next: ReminderSettingsInput) => {
    setInput(next);
    setPreview(undefined);
  };
  const revision = (current: ReminderSettingsView): ReminderSettingsRevision => ({
    id: current.reminder.id,
    expectedVersion: current.reminder.version,
    idempotencyKey: crypto.randomUUID(),
  });
  const accept = (next: ReminderSettingsView) => {
    if (mounted.current && currentSource.current === source) apply({ kind: "ready", view: next });
  };
  const editable =
    state.kind === "empty" || (state.kind === "ready" && view?.reminder.state !== "canceled");
  return (
    <section aria-label="Reminder settings" aria-busy={pending || state.kind === "loading"}>
      <h2>Reminder settings</h2>
      {state.kind === "loading" && <p role="status">Loading reminders…</p>}
      {state.kind === "empty" && <p>No reminder yet. Choose when you want to be reminded.</p>}
      {(state.kind === "denied" || state.kind === "error") && <p role="alert">{state.message}</p>}
      {state.kind === "partial" && (
        <p role="alert">
          {state.message ?? "Reminder history is incomplete. Reload before making changes."}
        </p>
      )}
      {view && (
        <p role="status">
          {view.reminder.state} · Next: {view.nextLocalTime ?? "None"}
          {view.reminder.nextScheduledAt && (
            <> · UTC {view.reminder.nextScheduledAt.toISOString()}</>
          )}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || state.kind === "loading"}
        onClick={() =>
          void run(async () => {
            const next = await source.load();
            if (mounted.current && currentSource.current === source) apply(next);
          })
        }
      >
        Reload reminders
      </button>
      {(state.kind === "empty" || view) && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!editable || !preview || error || !channels.includes(input.channel)) return;
            void run(async () =>
              accept(
                await source.save(
                  view
                    ? { kind: "update", ...revision(view), input }
                    : { kind: "create", input, idempotencyKey: crypto.randomUUID() },
                ),
              ),
            );
          }}
        >
          <fieldset disabled={pending || !editable || Boolean(error)}>
            <legend>Schedule</legend>
            <label htmlFor={`${prefix}-time`}>Local time</label>
            <input
              id={`${prefix}-time`}
              type="time"
              required
              value={input.schedule.localTime}
              onChange={(event) =>
                change({ ...input, schedule: { ...input.schedule, localTime: event.target.value } })
              }
            />
            <label htmlFor={`${prefix}-zone`}>IANA timezone</label>
            <input
              id={`${prefix}-zone`}
              required
              value={input.timezone}
              onChange={(event) => change({ ...input, timezone: event.target.value })}
            />
            <label htmlFor={`${prefix}-channel`}>Channel</label>
            <select
              id={`${prefix}-channel`}
              value={input.channel}
              onChange={(event) => {
                const channel = channels.find((value) => value === event.target.value);
                if (channel) change({ ...input, channel });
              }}
            >
              {channels.map((channel) => (
                <option key={channel} value={channel}>
                  {channel}
                </option>
              ))}
            </select>
            <label htmlFor={`${prefix}-grace`}>Delivery grace (milliseconds)</label>
            <input
              id={`${prefix}-grace`}
              type="number"
              min="0"
              step="1"
              required
              value={input.lateDeliveryMs}
              onChange={(event) => change({ ...input, lateDeliveryMs: event.target.valueAsNumber })}
            />
            <p>Missed occurrences beyond this grace period are skipped.</p>
            <fieldset>
              <legend>Weekdays</legend>
              {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map(
                (label, day) => (
                  <label key={label}>
                    <input
                      type="checkbox"
                      checked={input.schedule.weekdays.includes(day)}
                      onChange={(event) =>
                        change({
                          ...input,
                          schedule: {
                            ...input.schedule,
                            weekdays: event.target.checked
                              ? [...input.schedule.weekdays, day].sort()
                              : input.schedule.weekdays.filter((value) => value !== day),
                          },
                        })
                      }
                    />
                    {label}
                  </label>
                ),
              )}
            </fieldset>
            <button
              type="button"
              onClick={() =>
                void run(async () => {
                  const next = await source.preview(input);
                  if (mounted.current && currentSource.current === source) setPreview(next);
                })
              }
            >
              Preview next occurrence
            </button>
            {preview && (
              <p role="status">
                Server preview: {preview.localTime} · UTC {preview.nextScheduledAt.toISOString()}
              </p>
            )}
            <button type="submit" disabled={!preview}>
              {view ? "Save reminder" : "Create reminder"}
            </button>
          </fieldset>
        </form>
      )}
      {view && view.reminder.state !== "canceled" && (
        <>
          <SnoozeControl
            disabled={pending || !editable || Boolean(error)}
            onSnooze={(until) =>
              run(async () => accept(await source.snooze({ ...revision(view), until })))
            }
          />
          <p>Cancel stops future occurrences. Messages already accepted cannot be recalled.</p>
          <button
            type="button"
            disabled={pending || !editable || Boolean(error)}
            onClick={() => void run(async () => accept(await source.cancel(revision(view))))}
          >
            Cancel reminder
          </button>
        </>
      )}
    </section>
  );
}
