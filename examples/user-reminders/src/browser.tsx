import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { ReminderSettingsForm } from "@croco/frontend-react";
import type {
  ReminderSettingsInput,
  ReminderSettingsSource,
  ReminderSettingsView,
} from "@croco/frontend-react";
import { ReminderOperationsPanel } from "@croco/admin-react";
import type { ReminderOperationsSource, ReminderOperationsState } from "@croco/admin-core";
import type { Reminder, ReminderOccurrence } from "@croco/engagement-core";

type Snapshot = { reminders: Reminder[]; occurrences: ReminderOccurrence[] };
async function request(path: string, body?: unknown): Promise<unknown> {
  const response = await fetch(
    `/api/${path}`,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Request failed (${response.status}): ${JSON.stringify(result)}`);
  return result;
}
async function snapshot(path = "reminders", body?: unknown): Promise<Snapshot> {
  const value = (await request(path, body)) as Snapshot;
  return {
    reminders: value.reminders.map((item) => ({
      ...item,
      nextScheduledAt: item.nextScheduledAt === null ? null : new Date(item.nextScheduledAt),
    })),
    occurrences: value.occurrences.map((item) => ({
      ...item,
      scheduledAt: new Date(item.scheduledAt),
    })),
  };
}
function local(reminder: Reminder): string | null {
  return (
    reminder.nextScheduledAt?.toLocaleString("en-US", {
      timeZone: reminder.timezone,
      timeZoneName: "short",
    }) ?? null
  );
}
function view(reminder: Reminder): ReminderSettingsView {
  return { reminder, nextLocalTime: local(reminder) };
}
const initial: ReminderSettingsInput = {
  topic: "tasks",
  resourceRef: "task-1",
  timezone: "Asia/Seoul",
  schedule: { localTime: "09:00", weekdays: [1] },
  channel: "email",
  lateDeliveryMs: 60_000,
};

function App() {
  const [epoch, setEpoch] = useState(0);
  const [workerError, setWorkerError] = useState<string>();
  const owner = useMemo<ReminderSettingsSource>(
    () => ({
      load: async () => {
        const current = (await snapshot()).reminders
          .filter((item) => item.state !== "canceled")
          .at(-1);
        return current ? { kind: "ready", view: view(current) } : { kind: "empty" };
      },
      preview: async (input) => {
        const result = (await request("preview", { input })) as {
          scheduledAt: string;
          local: string;
        };
        return { nextScheduledAt: new Date(result.scheduledAt), localTime: result.local };
      },
      save: async (command) => {
        const id = command.kind === "create" ? crypto.randomUUID() : command.id;
        const result = await snapshot(command.kind, { ...command, id });
        const saved = result.reminders.find((item) => item.id === id);
        if (!saved) throw new Error("Saved reminder is absent");
        setEpoch((value) => value + 1);
        return view(saved);
      },
      snooze: async (command) => {
        const result = await snapshot("snooze", command);
        const saved = result.reminders.find((item) => item.id === command.id);
        if (!saved) throw new Error("Snoozed reminder is absent");
        setEpoch((value) => value + 1);
        return view(saved);
      },
      cancel: async (command) => {
        const result = await snapshot("cancel", command);
        const saved = result.reminders.find((item) => item.id === command.id);
        if (!saved) throw new Error("Canceled reminder is absent");
        setEpoch((value) => value + 1);
        return view(saved);
      },
    }),
    [],
  );
  const operations = useMemo<ReminderOperationsSource>(() => {
    const load = async (): Promise<ReminderOperationsState> => {
      const result = await snapshot();
      return result.reminders.length
        ? {
            kind: "ready",
            rows: result.reminders.map((reminder) => ({
              reminder,
              nextLocalTime: local(reminder),
              occurrences: result.occurrences.filter(
                (occurrence) => occurrence.reminderId === reminder.id,
              ),
            })),
          }
        : { kind: "empty" };
    };
    return {
      load,
      cancel: async (command) => {
        await snapshot("operator-cancel", command);
        return load();
      },
    };
  }, []);
  return (
    <>
      <ReminderSettingsForm
        scopeKey="demo-user"
        source={owner}
        initialInput={initial}
        channels={["email"]}
      />
      <div className="controls">
        <button
          type="button"
          onClick={() =>
            void request("tick", {}).then(
              () => {
                setWorkerError(undefined);
                setEpoch((value) => value + 1);
              },
              (error) => {
                setWorkerError(String(error));
                setEpoch((value) => value + 1);
              },
            )
          }
        >
          Run due worker
        </button>
      </div>
      {workerError && <p role="alert">{workerError}</p>}
      <ReminderOperationsPanel
        key={epoch}
        scopeKey="demo-tenant"
        actor="demo-operator"
        permissions={["reminder.read", "reminder.cancel"]}
        source={operations}
      />
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new Error("Example root is missing");
createRoot(root).render(<App />);
