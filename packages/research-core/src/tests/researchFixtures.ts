// croco-test-clock: controlled
import { fixedClock } from "@croco/testing";
import { vi } from "vitest";
import { InMemoryResearchStore, ResearchService } from "../index";
import type {
  Candidate,
  ResearchAuthorizer,
  ResearchAccess,
  ResearchCommand,
  ResearchScope,
  StudyDefinition,
} from "../index";
export const scope: ResearchScope = { app: "research", environment: "test", tenantId: "tenant" };
export const access: ResearchAccess = { scope, actor: "operator", principal: "verified-session" };
export const study: StudyDefinition = {
  id: "study",
  version: 1,
  groups: [
    { id: "achieved", quota: 2, outcome: "achieved" },
    { id: "comparison", quota: 2, outcome: "not-achieved" },
  ],
  quotaUnit: "active-invitations",
  slotPolicy: "release-declined-withdrawn",
  seed: "seed-42",
  datasetDefinition: "value-action-v1/30-days",
  sourceSnapshotId: "snapshot-1",
  observationEndsAt: "2026-10-01T00:00:00Z",
  bookingUrl: "https://booking.example.invalid/interview",
  contactPolicy: {
    perStudyCap: 1,
    excludeParticipatedSince: "2026-09-01T00:00:00Z",
    excludeContactedSince: "2026-09-15T00:00:00Z",
  },
  noteRetentionDays: 7,
};
export function candidates(): Candidate[] {
  return ["achieved", "comparison"].flatMap((group) =>
    Array.from({ length: 4 }, (_, index) => ({
      subject: `${group}-${index}`,
      group,
      sourceSnapshotId: study.sourceSnapshotId,
      observedThrough: "2026-10-02T00:00:00Z",
      eligible: true,
      contactConsent: true,
      consentSource: "verified-import",
      consentRecordedAt: "2026-09-20T00:00:00Z",
    })),
  );
}
export const command = (revision: number, key: string): ResearchCommand => ({
  expectedRevision: revision,
  idempotencyKey: key,
  reason: "Synthetic verification",
  source: "test-command",
});

/** Every reader, permission variant and restarted service uses this fixture's timeline. */
export function createResearchFixture(initial = "2026-10-13T00:00:00Z") {
  const time = fixedClock(initial);
  const clock = () => time.now;
  const store = new InMemoryResearchStore();
  const send = vi.fn(async () => ({ status: "queued" as const, executionIds: ["execution"] }));
  const createService = (
    authorizer: ResearchAuthorizer = {
      authorize: async (input, permission) =>
        input.principal === "verified-session" &&
        !(input.actor === "reader" && permission !== "research.read"),
    },
  ) => new ResearchService(store, authorizer, { send }, [study.bookingUrl], clock);
  return { time, clock, store, send, createService, service: createService() };
}
