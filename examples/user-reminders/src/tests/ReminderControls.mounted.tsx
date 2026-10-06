import { createRoot } from "react-dom/client";
import { ReminderSettingsForm } from "@croco/frontend-react";
import type {
  ReminderSettingsState,
  ReminderSettingsSource,
  ReminderSettingsInput,
} from "@croco/frontend-react";
import { ReminderOperationsPanel } from "@croco/admin-react";
import type { ReminderOperationsState } from "@croco/admin-core";
import type { Reminder } from "@croco/engagement-core";

/** Browser-only state fixture; absent from shipped package entrypoints and the standalone app bundle. */
export function mountReminderControlsFixture(
  container: HTMLElement,
  kind: "loading" | "empty" | "denied" | "partial" | "error" | "ready",
): void {
  const input: ReminderSettingsInput = {
    topic: "tasks",
    resourceRef: "task-1",
    timezone: "Asia/Seoul",
    schedule: { localTime: "09:00", weekdays: [1] },
    channel: "email",
    lateDeliveryMs: 60000,
  };
  const reminder: Reminder = {
    ...input,
    id: "synthetic-reminder",
    scope: { app: "fixture", environment: "test", tenantId: "synthetic-tenant" },
    subject: "synthetic-user",
    version: 1,
    state: "active",
    nextScheduledAt: new Date("2026-10-12T00:00:00Z"),
  };
  const view = { reminder, nextLocalTime: "2026-10-12 09:00 Asia/Seoul" };
  let ownerCalls = 0;
  let adminCalls = 0;
  const ownerState = (state: typeof kind): ReminderSettingsState =>
    state === "denied" || state === "error"
      ? {
          kind: state,
          message:
            state === "denied" ? "Verified subject access denied." : "Reminder source unavailable.",
        }
      : state === "ready" || state === "partial"
        ? {
            kind: state,
            view,
            message: state === "partial" ? "Occurrence history incomplete." : undefined,
          }
        : { kind: state };
  const adminState = (state: typeof kind): ReminderOperationsState =>
    state === "denied" || state === "error"
      ? {
          kind: state,
          message:
            state === "denied" ? "Operator access denied." : "Operations source unavailable.",
        }
      : state === "ready" || state === "partial"
        ? {
            kind: state,
            rows: [{ reminder, nextLocalTime: view.nextLocalTime, occurrences: [] }],
            message: state === "partial" ? "Occurrence history incomplete." : undefined,
          }
        : { kind: state };
  const source: ReminderSettingsSource = {
    load: async () => {
      if (kind === "loading") return new Promise(() => {});
      ownerCalls++;
      return ownerState(
        ownerCalls > 1 && (kind === "error" || kind === "partial") ? "ready" : kind,
      );
    },
    preview: async () => ({
      nextScheduledAt: new Date("2026-10-12T00:00:00Z"),
      localTime: view.nextLocalTime,
    }),
    save: async () => {
      throw new Error("Fixture mutation intentionally unavailable");
    },
    snooze: async () => {
      throw new Error("Fixture mutation intentionally unavailable");
    },
    cancel: async () => {
      throw new Error("Fixture mutation intentionally unavailable");
    },
  };
  createRoot(container).render(
    <>
      <ReminderSettingsForm
        scopeKey="synthetic-user"
        source={source}
        initialInput={input}
        channels={["email"]}
      />
      <ReminderOperationsPanel
        scopeKey="synthetic-tenant"
        actor="synthetic-operator"
        permissions={kind === "denied" ? [] : ["reminder.read", "reminder.cancel"]}
        source={{
          load: async () => {
            if (kind === "loading") return new Promise(() => {});
            adminCalls++;
            return adminState(
              adminCalls > 1 && (kind === "error" || kind === "partial") ? "ready" : kind,
            );
          },
          cancel: async () => {
            throw new Error("Fixture mutation intentionally unavailable");
          },
        }}
      />
    </>,
  );
}
