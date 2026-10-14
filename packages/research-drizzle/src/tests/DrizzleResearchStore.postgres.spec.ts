import { describe, expect, it, beforeAll, beforeEach, afterAll, vi } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql } from "drizzle-orm";
import { ResearchService, ResearchConflictProblem } from "@croco/research-core";
import { DrizzleResearchStore, createResearchSchema, researchStudies } from "../index";
import type {
  Candidate,
  ResearchAccess,
  ResearchCommand,
  StudyDefinition,
} from "@croco/research-core";
const url = process.env.RESEARCH_POSTGRES_URL;
const suite = url ? describe : describe.skip;
const scope = { app: "app", environment: "test", tenantId: "tenant" };
const access: ResearchAccess = { scope, actor: "operator", principal: "server" };
const command = (revision: number, key: string): ResearchCommand => ({
  expectedRevision: revision,
  idempotencyKey: key,
  reason: "Synthetic provider evidence",
  source: "test",
});
const study: StudyDefinition = {
  id: "study",
  version: 1,
  groups: [
    { id: "a", quota: 2, outcome: "achieved" },
    { id: "b", quota: 2, outcome: "not-achieved" },
  ],
  quotaUnit: "active-invitations",
  slotPolicy: "release-declined-withdrawn",
  seed: "seed",
  datasetDefinition: "definition",
  sourceSnapshotId: "snapshot",
  observationEndsAt: "2026-10-01T00:00:00Z",
  bookingUrl: "https://booking.invalid/interview",
  contactPolicy: {
    perStudyCap: 1,
    excludeParticipatedSince: "2026-09-01T00:00:00Z",
    excludeContactedSince: "2026-09-01T00:00:00Z",
  },
  noteRetentionDays: 7,
};
const candidates: Candidate[] = ["a", "b"].flatMap((group) =>
  Array.from({ length: 6 }, (_, i) => ({
    subject: `${group}-${i}`,
    group,
    sourceSnapshotId: "snapshot",
    observedThrough: "2026-10-02T00:00:00Z",
    eligible: true,
    contactConsent: true,
    consentSource: "import",
    consentRecordedAt: "2026-09-20T00:00:00Z",
  })),
);
suite("DrizzleResearchStore PostgreSQL", () => {
  const pools = [
    new Pool({ connectionString: url, max: 1 }),
    new Pool({ connectionString: url, max: 1 }),
  ];
  const dbs = pools.map((pool) => drizzle(pool, { schema: { researchStudies } }));
  const stores = dbs.map((db) => new DrizzleResearchStore(db));
  const service = (store: DrizzleResearchStore) =>
    new ResearchService(
      store,
      { authorize: async () => true },
      { send: async () => ({ status: "queued", executionIds: ["logical-send"] }) },
      [study.bookingUrl],
    );
  beforeAll(async () => {
    await createResearchSchema(dbs[0]);
    await createResearchSchema(dbs[0]);
  });
  beforeEach(async () => {
    await dbs[0].execute(sql`truncate research_studies`);
  });
  afterAll(async () => {
    await dbs[0].execute(sql`drop table if exists research_studies`);
    await Promise.all(pools.map((pool) => pool.end()));
  });
  it("serializes competing quota claims on two connections, persists consent/participation and restores a fresh service", async () => {
    const first = service(stores[0]);
    await first.publishStudy(scope, study, access, command(0, "publish"));
    await first.importCandidates(scope, study.id, candidates, access, command(1, "import"));
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) =>
        service(stores[i % 2]).selectCandidates(scope, study.id, access, command(2, `select-${i}`)),
      ),
    );
    expect(results.filter((value) => value.status === "fulfilled")).toHaveLength(1);
    expect((await stores[1].read(scope, study.id)).invitations).toHaveLength(4);
    const selected = (await stores[1].read(scope, study.id)).invitations[0].subject;
    await first.invite(scope, study.id, selected, access, command(3, "invite"));
    await first.recordConsent(
      scope,
      study.id,
      selected,
      { contact: true, participation: true },
      access,
      command(5, "consent"),
    );
    await first.recordResponse(
      scope,
      study.id,
      selected,
      "accepted",
      access,
      command(6, "accepted"),
    );
    await first.markParticipated(scope, study.id, selected, access, command(7, "participated"));
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      const restarted = service(
        new DrizzleResearchStore(drizzle(pool, { schema: { researchStudies } })),
      );
      expect((await restarted.inspect(scope, study.id, access)).groups[0]).toMatchObject({
        held: 2,
        invited: 1,
        accepted: 1,
        participated: 1,
      });
      await restarted.invite(scope, study.id, selected, access, command(3, "invite"));
      const persisted = await stores[1].read(scope, study.id);
      expect(persisted.invitations[0].contactCount).toBe(1);
      expect(persisted.consents.filter((event) => event.subject === selected)).toHaveLength(2);
      expect(
        persisted.history
          .filter((event) => event.subject === selected)
          .flatMap((event) => event.transitions ?? [])
          .map((event) => event.state),
      ).toEqual(["admitted", "unknown", "invited", "accepted", "participated"]);
    } finally {
      await pool.end();
    }
    expect(
      (await stores[0].read({ ...scope, tenantId: "other" }, study.id)).definition,
    ).toBeUndefined();
  });
  it("rolls back rejected writes and preserves unresolved admissions and partial successes after restart", async () => {
    await stores[0].transact(scope, study.id, async (record) => {
      record.revision = 1;
    });
    await expect(
      stores[1].transact(scope, study.id, async (record) => {
        record.revision = 9;
        throw new ResearchConflictProblem("rollback");
      }),
    ).rejects.toThrow(ResearchConflictProblem);
    expect((await stores[0].read(scope, study.id)).revision).toBe(1);
    const first = service(stores[0]);
    await first.publishStudy(scope, study, access, command(1, "publish"));
    await first.importCandidates(scope, study.id, candidates, access, command(2, "import"));
    await first.selectCandidates(scope, study.id, access, command(3, "select"));
    const selected = (await stores[0].read(scope, study.id)).invitations;
    await first.invite(scope, study.id, selected[0].subject, access, command(4, "accepted-send"));
    const send = vi.fn(async () => {
      throw new ResearchConflictProblem("synthetic acceptance unknown");
    });
    const failing = new ResearchService(stores[1], { authorize: async () => true }, { send }, [
      study.bookingUrl,
    ]);
    await expect(
      failing.invite(scope, study.id, selected[1].subject, access, command(6, "unknown-send")),
    ).rejects.toThrow(ResearchConflictProblem);
    const pool = new Pool({ connectionString: url, max: 1 });
    try {
      const store = new DrizzleResearchStore(drizzle(pool, { schema: { researchStudies } }));
      const restarted = new ResearchService(store, { authorize: async () => true }, { send }, [
        study.bookingUrl,
      ]);
      await restarted.invite(
        scope,
        study.id,
        selected[1].subject,
        access,
        command(6, "unknown-send"),
      );
      const page = await restarted.inspect(scope, study.id, access);
      expect(page.groups[0]).toMatchObject({ held: 2, invited: 1, unknown: 1 });
      expect(send).toHaveBeenCalledTimes(1);
      expect(
        (await store.read(scope, study.id)).invitations.slice(0, 2).map((value) => value.state),
      ).toEqual(["invited", "unknown"]);
    } finally {
      await pool.end();
    }
  });
});
