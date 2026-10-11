import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ReactElement } from "react";
import { createRoot } from "react-dom/client";
import { ReminderOperationsPanel } from "@croco/admin-react";
import type { ReminderOperationsState } from "@croco/admin-core";

/** Exercises permission commits and row reconciliation without adding product controls. */
export function mountReminderOperationsReviewFixture(container: HTMLElement): void {
  createRoot(container).render(<ReminderOperationsReviewFixture />);
}

function ReminderOperationsReviewFixture(): ReactElement {
  const [allowed, setAllowed] = useState(true);
  const [reversed, setReversed] = useState(false);
  const [commit, setCommit] = useState("");
  const rows = useRef([
    {
      reminder: {
        id: "shared-reminder",
        scope: { app: "fixture", environment: "test", tenantId: "tenant-a" },
        subject: "subject-a",
        version: 1,
        state: "active" as const,
        topic: "tasks",
        resourceRef: "task-a",
        timezone: "Asia/Seoul",
        schedule: { localTime: "09:00", weekdays: [1] },
        channel: "email" as const,
        lateDeliveryMs: 60000,
        nextScheduledAt: new Date("2026-10-12T00:00:00Z"),
      },
      nextLocalTime: "Subject A · 2026-10-12 09:00 Asia/Seoul",
      occurrences: [],
    },
    {
      reminder: {
        id: "shared-reminder",
        scope: { app: "fixture", environment: "test", tenantId: "tenant-a" },
        subject: "subject-b",
        version: 1,
        state: "active" as const,
        topic: "tasks",
        resourceRef: "task-b",
        timezone: "America/New_York",
        schedule: { localTime: "09:00", weekdays: [1] },
        channel: "email" as const,
        lateDeliveryMs: 60000,
        nextScheduledAt: new Date("2026-10-12T13:00:00Z"),
      },
      nextLocalTime: "Subject B · 2026-10-12 09:00 America/New_York",
      occurrences: [],
    },
  ]);
  if (rows.current.length === 2) {
    rows.current.push({
      ...rows.current[1],
      reminder: {
        ...rows.current[1].reminder,
        scope: { ...rows.current[1].reminder.scope, tenantId: "tenant-b" },
      },
      nextLocalTime: "Subject C · tenant-b · 2026-10-12 09:00 America/New_York",
    });
  }
  const reversedRef = useRef(reversed);
  reversedRef.current = reversed;
  const source = useMemo(
    () => ({
      load: async (): Promise<ReminderOperationsState> => ({
        kind: "ready",
        rows: reversedRef.current ? [...rows.current].reverse() : rows.current,
      }),
      cancel: async (): Promise<ReminderOperationsState> => {
        throw new Error("Read-only review fixture");
      },
    }),
    [],
  );
  useLayoutEffect(() => {
    if (!allowed) {
      const panel = document.querySelector('[aria-label="Reminder operations"]');
      setCommit(
        panel?.querySelector("article")
          ? "FAIL: protected rows remained in the revocation commit"
          : "PASS: no protected rows in the revocation commit",
      );
    }
  }, [allowed]);
  return (
    <>
      <h1>Reminder review regression fixture</h1>
      <button type="button" onClick={() => setAllowed(false)}>
        Revoke read permission
      </button>
      <button type="button" onClick={() => setReversed((value) => !value)}>
        Reverse source row order
      </button>
      <p role="status">{reversed ? "Source order: C, B, A" : "Source order: A, B, C"}</p>
      <output aria-label="Revocation commit result">{commit}</output>
      <ReminderOperationsPanel
        scopeKey="review-fixture"
        actor="synthetic-operator"
        permissions={allowed ? ["reminder.read", "reminder.cancel"] : ["reminder.cancel"]}
        source={source}
      />
    </>
  );
}
