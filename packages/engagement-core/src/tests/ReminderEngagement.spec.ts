import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { defineMessage } from "../libs/MessageContracts";
import { EngagementService, InMemoryRecipientDirectory } from "../libs/EngagementService";
import { createReminderEngagementSender } from "../libs/ReminderEngagement";
import { ReminderInvalidProblem } from "../libs/ReminderContracts";
import type { Reminder, ReminderOccurrence } from "../libs/ReminderContracts";

const message = defineMessage({
  id: "reminder",
  topic: "tasks",
  data: z.object({ resource: z.string() }),
  channels: ["email"],
});
const reminder: Reminder = {
  id: "r",
  scope: { app: "app", environment: "test", tenantId: "tenant" },
  subject: "user",
  version: 1,
  state: "active",
  nextScheduledAt: new Date("2026-10-05T00:00:00Z"),
  topic: "tasks",
  resourceRef: "task-1",
  timezone: "Asia/Seoul",
  schedule: { localTime: "09:00", weekdays: [1] },
  channel: "email",
  lateDeliveryMs: 60000,
};
const occurrence: ReminderOccurrence = {
  id: "occurrence-1",
  reminderId: "r",
  reminderVersion: 1,
  scheduledAt: new Date("2026-10-05T00:00:00Z"),
  state: "unknown",
  executionIds: [],
};

describe("Reminder engagement bridge", () => {
  it("uses scoped recipient, occurrence semantic key and existing suppression path", async () => {
    const dispatch = vi.fn(async () => ({ executionId: "execution-1" }));
    const evaluate = vi.fn(async () => ({ suppressed: true, kind: "preference" as const }));
    const engagement = new EngagementService(
      new InMemoryRecipientDirectory([
        {
          recipient: { tenantId: "tenant", userId: "user" },
          email: { id: "endpoint", address: "synthetic@example.invalid" },
          push: [],
        },
      ]),
      { render: vi.fn() },
      { prepareDispatch: () => ({ dispatch }) },
      { evaluate },
    );
    const sender = createReminderEngagementSender(engagement, [
      { message, data: async (value) => ({ resource: value.resourceRef }) },
    ]);
    expect(await sender(reminder, occurrence)).toMatchObject({
      status: "suppressed",
      reason: "preference",
    });
    expect(evaluate).toHaveBeenCalledWith(
      expect.objectContaining({
        recipient: { tenantId: "tenant", userId: "user" },
        topic: "tasks",
      }),
    );
    expect(dispatch).not.toHaveBeenCalled();
  });
  it("reports no endpoint through the existing send result", async () => {
    const engagement = new EngagementService(
      new InMemoryRecipientDirectory([
        { recipient: { tenantId: "tenant", userId: "user" }, push: [] },
      ]),
      { render: vi.fn() },
      { prepareDispatch: vi.fn() },
    );
    expect(
      await createReminderEngagementSender(engagement, [
        { message, data: async () => ({ resource: "task-1" }) },
      ])(reminder, occurrence),
    ).toMatchObject({ status: "suppressed", reason: "no-endpoint" });
  });
  it("rejects unregistered topics and duplicate or multichannel registrations", async () => {
    const engagement = new EngagementService(
      new InMemoryRecipientDirectory(),
      { render: vi.fn() },
      { prepareDispatch: vi.fn() },
    );
    const binding = { message, data: async () => ({ resource: "task-1" }) };
    expect(() => createReminderEngagementSender(engagement, [binding, binding])).toThrow(
      ReminderInvalidProblem,
    );
    await expect(
      createReminderEngagementSender(engagement, [binding])(
        { ...reminder, topic: "other" },
        occurrence,
      ),
    ).rejects.toThrow(ReminderInvalidProblem);
    const multi = defineMessage({
      id: "multi",
      topic: "tasks",
      data: z.object({}),
      channels: ["email", "push"],
    });
    expect(() =>
      createReminderEngagementSender(engagement, [{ message: multi, data: async () => ({}) }]),
    ).toThrow(ReminderInvalidProblem);
  });
});
