import "reflect-metadata";
import {
  EngagementService,
  InMemoryRecipientDirectory,
  defineMessage,
  Renders,
  MessageRendererRegistry,
  InMemoryMessageRendererResolver,
  RegistryEngagementMessageRenderer,
} from "@croco/engagement-core";
import {
  InMemoryResearchStore,
  ResearchService,
  ResearchConflictProblem,
} from "@croco/research-core";
import { ResearchOperations } from "@croco/admin-core";
import { z } from "zod";
import type { ResearchAccess, StudyDefinition, Candidate } from "@croco/research-core";
/** Synthetic fixture: no provider credentials or network dispatcher. Hosts replace authorization and persistence. */
export async function createRecruitmentFixture(importRows = true) {
  const scope = { app: "synthetic-research", environment: "test", tenantId: "fixture-tenant" };
  const access: ResearchAccess = {
    scope,
    actor: "synthetic-operator",
    principal: "local-fixture-only",
  };
  const definition: StudyDefinition = {
    id: "value-action-study",
    version: 1,
    groups: [
      { id: "achieved", quota: 2, outcome: "achieved" },
      { id: "comparison", quota: 2, outcome: "not-achieved" },
    ],
    quotaUnit: "active-invitations",
    slotPolicy: "release-declined-withdrawn",
    seed: "research-seed",
    datasetDefinition: "value-action/30-days",
    sourceSnapshotId: "synthetic-snapshot",
    observationEndsAt: "2026-10-01T00:00:00Z",
    bookingUrl: "https://booking.example.invalid/interview",
    contactPolicy: {
      perStudyCap: 1,
      excludeParticipatedSince: "2026-09-01T00:00:00Z",
      excludeContactedSince: "2026-09-01T00:00:00Z",
    },
    noteRetentionDays: 7,
  };
  const rows: Candidate[] = ["achieved", "comparison"].flatMap((group) =>
    Array.from({ length: 4 }, (_, i) => ({
      subject: `${group}-${i}`,
      group,
      sourceSnapshotId: definition.sourceSnapshotId,
      observedThrough: "2026-10-02T00:00:00Z",
      eligible: true,
      contactConsent: true,
      consentSource: "synthetic-import",
      consentRecordedAt: "2026-09-20T00:00:00Z",
    })),
  );
  rows.push({
    ...rows[4],
    subject: "incomplete-observation",
    observedThrough: "2026-09-30T00:00:00Z",
  });
  const directory = new InMemoryRecipientDirectory(
    rows.map((candidate) => ({
      recipient: { tenantId: scope.tenantId, userId: candidate.subject },
      email: { id: candidate.subject, address: "synthetic@example.invalid" },
      push: [],
    })),
  );
  let dispatchCount = 0;
  let failNextDispatch = false;
  const message = defineMessage({
    id: "synthetic-research",
    topic: "research",
    data: z.object({ bookingUrl: z.string() }),
    channels: ["email"],
  });
  @Renders(message)
  class InvitationRenderer {
    email() {
      return {
        subject: "Synthetic research invitation",
        html: "<p>No external contact is made</p>",
        text: "No external contact is made",
      };
    }
  }
  const registry = new MessageRendererRegistry();
  registry.registerMessage(message);
  registry.registerRenderer(InvitationRenderer);
  registry.bootstrap();
  const resolver = new InMemoryMessageRendererResolver();
  resolver.register(message, new InvitationRenderer());
  const engagement = new EngagementService(
    directory,
    new RegistryEngagementMessageRenderer(registry, resolver),
    {
      prepareDispatch: () => ({
        dispatch: async () => {
          if (failNextDispatch) {
            failNextDispatch = false;
            throw new ResearchConflictProblem("Synthetic acceptance unknown");
          }
          return { executionId: `synthetic-execution-${++dispatchCount}` };
        },
      }),
    },
  );
  const { createResearchEngagementSender } = await import("@croco/research-core");
  const store = new InMemoryResearchStore();
  const service = new ResearchService(
    store,
    {
      authorize: async (session) =>
        session.principal === access.principal && session.actor === access.actor,
    },
    createResearchEngagementSender(engagement, message, async (study) => ({
      bookingUrl: study.bookingUrl,
    })),
    [definition.bookingUrl],
    () => new Date("2026-10-13T00:00:00Z"),
  );
  await service.publishStudy(scope, definition, access, {
    expectedRevision: 0,
    idempotencyKey: "publish",
    reason: "Synthetic fixture",
    source: "example",
  });
  if (importRows)
    await service.importCandidates(scope, definition.id, rows, access, {
      expectedRevision: 1,
      idempotencyKey: "import",
      reason: "Synthetic fixture",
      source: "example",
    });
  return {
    scope,
    access,
    definition,
    service,
    operations: new ResearchOperations(service),
    dispatchCount: () => dispatchCount,
    failNextDispatch: () => {
      failNextDispatch = true;
    },
  };
}
