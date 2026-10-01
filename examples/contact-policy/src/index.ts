import assert from "node:assert/strict";

import { ContactPolicy, InMemoryContactPolicyStore } from "@croco/engagement-core";
import type { ContactPolicyRequest } from "@croco/engagement-core";

const store = new InMemoryContactPolicyStore();
const policy = new ContactPolicy({
  store,
  config: {
    version: "campaign-budget-v1",
    rules: [{ id: "daily-email", channel: "email", limit: 1, windowMs: 24 * 60 * 60 * 1000 }],
    quietHours: { startMinute: 22 * 60, endMinute: 8 * 60, timezone: "Asia/Seoul" },
    reservationTtlMs: 15 * 60 * 1000,
  },
  topics: [
    { id: "campaign", kind: "marketing", priority: 10, messageIds: ["trial-reminder"] },
    { id: "account-security", kind: "security", priority: 100, messageIds: ["login-alert"] },
  ],
});

const baseRequest: ContactPolicyRequest = {
  scope: { app: "shop", environment: "production", tenantId: "tenant-1" },
  recipient: "customer-1",
  channel: "email",
  topic: "campaign",
  messageId: "trial-reminder",
  logicalSendId: "campaign-a:customer-1:email",
  payloadFingerprint: "synthetic-payload-v1",
  now: new Date("2026-09-29T03:00:00.000Z"),
};

async function main(): Promise<void> {
  const preview = await policy.evaluate(baseRequest);
  assert.equal(preview.allowed, true);
  assert.deepEqual(await store.read(baseRequest.scope, "recipient:customer-1"), []);

  const attempts = await Promise.all(
    Array.from({ length: 10 }, (_, index) =>
      policy.reserve({ ...baseRequest, logicalSendId: `campaign-${index}:customer-1:email` }),
    ),
  );
  assert.equal(attempts.filter((attempt) => attempt.decision.allowed).length, 1);

  const winner = attempts.find((attempt) => attempt.reservation !== undefined)?.reservation;
  assert.ok(winner);
  const reservationRef = {
    scope: winner.scope,
    subject: winner.subject,
    logicalSendId: winner.logicalSendId,
  };
  await policy.markUnknown(reservationRef);
  await policy.commit(reservationRef, ["synthetic-execution-1"]);

  const replay = await policy.reserve({ ...baseRequest, logicalSendId: winner.logicalSendId });
  assert.equal(replay.replay, true);
  assert.equal(replay.reservation?.state, "committed");

  const blocked = await policy.evaluate({
    ...baseRequest,
    logicalSendId: "campaign-b:customer-1:email",
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.blockingRuleId, "daily-email");

  console.log({ preview, allowedReservations: 1, replay: replay.reservation?.state, blocked });
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
