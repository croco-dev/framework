import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { ExperimentRuntime, experimentHash } from "@croco/features-core";
import type {
  ExperimentAssignment,
  ExperimentCommand,
  ExperimentRecord,
} from "@croco/features-core";
import { DrizzleExperimentStore, createExperimentsSchema, dropExperimentsSchema } from "../index";
import type { FeaturePolicyPgDatabase } from "../index";

const connectionString = process.env.FEATURES_POSTGRES_URL ?? "";
const now = "2026-10-02T12:00:00.000Z";
const scope = { app: "shop", environment: "test", tenantId: "tenant-a" };
const subject = { kind: "user", id: "user-a" } as const;
const definition = {
  id: "checkout",
  revision: "v1",
  unit: "user",
  loginPolicy: "preserve-unit",
  salt: "checkout-2026",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [
    { id: "control", value: false, weight: 5000 },
    { id: "treatment", value: true, weight: 5000 },
  ],
  hypothesis: "shorter checkout",
  observationPlan: "purchase",
  eligibility: "all",
} as const;
const record: ExperimentRecord = {
  codeRevision: definition.revision,
  experimentId: definition.id,
  experimentRevision: definition.revision,
  scope,
  definition,
  definitionHash: experimentHash(definition),
  state: "draft",
  version: 0,
};
const candidate: ExperimentAssignment = {
  experimentId: record.experimentId,
  experimentRevision: record.experimentRevision,
  scope,
  subject,
  id: "assignment-a",
  variant: "control",
  value: false,
  assignedAt: now,
};
const start: ExperimentCommand = {
  experimentId: record.experimentId,
  experimentRevision: record.experimentRevision,
  scope,
  action: "start",
  expectedRevision: 0,
  actor: "operator",
  reason: "Launch",
  idempotencyKey: "start-1",
};
const pause: ExperimentCommand = {
  ...start,
  action: "pause",
  expectedRevision: 1,
  idempotencyKey: "pause-1",
};
function database(pool: Pool): FeaturePolicyPgDatabase {
  return drizzle(pool) as unknown as FeaturePolicyPgDatabase;
}

describe.skipIf(!connectionString)("DrizzleExperimentStore PostgreSQL", () => {
  let poolA: Pool;
  let poolB: Pool;
  let storeA: DrizzleExperimentStore;
  let storeB: DrizzleExperimentStore;
  beforeAll(async () => {
    poolA = new Pool({ connectionString, max: 4 });
    poolB = new Pool({ connectionString, max: 4 });
    await createExperimentsSchema(database(poolA));
  });
  beforeEach(async () => {
    await poolA.query(
      "truncate croco_feature_experiment_audit, croco_feature_experiment_commands, croco_feature_experiment_exposures, croco_feature_experiment_assignments, croco_feature_experiments cascade",
    );
    storeA = new DrizzleExperimentStore(database(poolA));
    storeB = new DrizzleExperimentStore(database(poolB));
    await storeA.register(record);
  });
  afterAll(async () => {
    await dropExperimentsSchema(database(poolA));
    await poolA.end();
    await poolB.end();
  });

  it("returns one assignment across two connections, competing candidates, and a fresh connection", async () => {
    await storeA.command(start, experimentHash(start), now);
    const winners = await Promise.all([
      storeA.assign(candidate, now),
      storeB.assign({ ...candidate, id: "assignment-b", variant: "treatment", value: true }, now),
    ]);
    expect(winners[0]).toEqual(winners[1]);
    expect(
      (await poolA.query("select count(*) from croco_feature_experiment_assignments")).rows[0]
        .count,
    ).toBe("1");
    await poolB.end();
    poolB = new Pool({ connectionString, max: 1 });
    storeB = new DrizzleExperimentStore(database(poolB));
    expect(await storeB.assign({ ...candidate, id: "assignment-restarted" }, now)).toEqual(
      winners[0],
    );
  });

  it("commits command receipts and audit once and rejects payload reuse and stale versions", async () => {
    const receipts = await Promise.all([
      storeA.command(start, experimentHash(start), now),
      storeB.command(start, experimentHash(start), now),
    ]);
    expect(receipts[0]).toEqual(receipts[1]);
    expect(
      (await poolA.query("select count(*) from croco_feature_experiment_audit")).rows[0].count,
    ).toBe("1");
    await expect(
      storeB.command({ ...start, reason: "different" }, experimentHash(start), now),
    ).rejects.toMatchObject({ code: "features/experiment/idempotency-conflict" });
    await expect(
      storeA.command({ ...pause, expectedRevision: 0 }, "stale", now),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
    expect((await storeA.get(record))?.version).toBe(1);
  });

  it("creates configured drafts and audit atomically while replaying only identical commands", async () => {
    await storeA.command(start, experimentHash(start), now);
    const nextDefinition = {
      ...definition,
      revision: "v2",
      allocation: 5000,
      variants: [{ id: "control", value: false, weight: 5000 }],
    };
    const next = {
      ...record,
      experimentRevision: "v2",
      definition: nextDefinition,
      definitionHash: experimentHash(nextDefinition),
    };
    const configure = {
      ...start,
      action: "configure",
      expectedRevision: 1,
      definition: nextDefinition,
      idempotencyKey: "configure-1",
    } as const;
    const results = await Promise.all([
      storeA.configure(configure, next, experimentHash(configure), now),
      storeB.configure(configure, next, experimentHash(configure), now),
    ]);
    expect(results[0]).toEqual(results[1]);
    expect(await storeB.get(next)).toEqual(next);
    expect((await storeA.get(record))?.state).toBe("running");
    expect(
      (await poolA.query("select count(*) from croco_feature_experiment_audit")).rows[0].count,
    ).toBe("2");
    await expect(
      storeB.configure({ ...configure, reason: "different" }, next, "different", now),
    ).rejects.toMatchObject({ code: "features/experiment/idempotency-conflict" });
    await expect(
      storeB.command({ ...pause, idempotencyKey: configure.idempotencyKey }, "same-key", now),
    ).rejects.toMatchObject({ code: "features/experiment/idempotency-conflict" });
    await expect(
      storeB.configure({ ...configure, idempotencyKey: "configure-2" }, next, "new", now),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
  });

  it("serializes concurrent state commands and keeps the stopped state terminal", async () => {
    await storeA.command(start, experimentHash(start), now);
    const stop = { ...pause, action: "stop", idempotencyKey: "stop-1" } as const;
    const results = await Promise.allSettled([
      storeA.command(pause, experimentHash(pause), now),
      storeB.command(stop, experimentHash(stop), now),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const current = await storeA.get(record);
    if (current?.state === "paused")
      await storeA.command({ ...stop, expectedRevision: 2 }, "stop-final", now);
    await expect(
      storeA.command({ ...start, expectedRevision: 3, idempotencyKey: "restart" }, "restart", now),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
  });

  it("blocks admission queued behind a pause transaction and preserves existing assignments", async () => {
    await storeA.command(start, experimentHash(start), now);
    await storeA.assign(candidate, now);
    let unlock = () => {};
    const gate = new Promise<void>((resolve) => {
      unlock = resolve;
    });
    let locked = () => {};
    const reached = new Promise<void>((resolve) => {
      locked = resolve;
    });
    const db = database(poolA);
    const pausedDatabase: FeaturePolicyPgDatabase = {
      execute: (query) => db.execute(query),
      transaction: (work) =>
        db.transaction((tx) => {
          let first = true;
          return work({
            execute: async (query) => {
              const result = await tx.execute(query);
              if (first) {
                first = false;
                locked();
                await gate;
              }
              return result;
            },
          });
        }),
    };
    const pausing = new DrizzleExperimentStore(pausedDatabase).command(
      pause,
      experimentHash(pause),
      now,
    );
    await reached;
    const assigning = storeB.assign(
      { ...candidate, id: "late-assignment", subject: { kind: "user", id: "new-user" } },
      now,
    );
    const treating = storeB.admit(candidate.id, scope, subject, now);
    unlock();
    await pausing;
    expect((await assigning).status).toBe("not_assigned");
    expect((await treating).status).toBe("not_assigned");
    expect(await storeB.getAssignment(candidate.id)).toEqual(candidate);
    expect((await storeB.assign(candidate, now)).status).toBe("not_assigned");
  });

  it("dedupes only the same delivery, accepts late exposure, and checks original ownership", async () => {
    await storeA.command(start, experimentHash(start), now);
    await storeA.assign(candidate, now);
    await storeA.command(pause, experimentHash(pause), now);
    const exposure = {
      id: "exposure-1",
      assignmentId: candidate.id,
      deliveryInstanceId: "delivery-1",
      occurredAt: now,
      kind: "display",
    } as const;
    const results = await Promise.all([
      storeA.recordExposure(exposure, scope, subject),
      storeB.recordExposure({ ...exposure, id: "exposure-retry" }, scope, subject),
    ]);
    expect(results[0]).toEqual(results[1]);
    await storeA.recordExposure(
      { ...exposure, id: "exposure-2", deliveryInstanceId: "delivery-2" },
      scope,
      subject,
    );
    expect(
      (await poolA.query("select count(*) from croco_feature_experiment_exposures")).rows[0].count,
    ).toBe("2");
    await expect(
      storeB.recordExposure({ ...exposure, kind: "treatment" }, scope, subject),
    ).rejects.toMatchObject({ code: "features/experiment/idempotency-conflict" });
    for (const badScope of [
      { ...scope, tenantId: "tenant-b" },
      { app: scope.app, environment: scope.environment, tenantId: null },
    ]) {
      await expect(storeB.recordExposure(exposure, badScope, subject)).rejects.toMatchObject({
        code: "features/experiment/forbidden",
      });
    }
    await expect(
      storeB.recordExposure(exposure, scope, { ...subject, id: "other" }),
    ).rejects.toMatchObject({ code: "features/experiment/forbidden" });
    await expect(
      storeB.recordExposure({ ...exposure, assignmentId: "forged" }, scope, subject),
    ).rejects.toMatchObject({ code: "features/experiment/missing" });
  });

  it("preserves revision definitions, tenant boundaries, and prior assignments", async () => {
    await storeA.command(start, experimentHash(start), now);
    await storeA.assign(candidate, now);
    await expect(
      storeA.register({ ...record, definition: { ...definition, salt: "changed" } }),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
    const nextDefinition = { ...definition, revision: "v2", salt: "new-salt" };
    await storeA.register({
      ...record,
      experimentRevision: "v2",
      definition: nextDefinition,
      definitionHash: experimentHash(nextDefinition),
    });
    expect(await storeA.getAssignment(candidate.id)).toEqual(candidate);
    expect(await storeA.list({ ...scope, tenantId: "other" })).toEqual([]);
    expect(
      await storeA.list({ app: scope.app, environment: scope.environment, tenantId: null }),
    ).toEqual([]);
    expect(await storeB.list(scope)).toHaveLength(2);
    await expect(
      storeA.assign({ ...candidate, subject: { kind: "anonymous", id: "anon" } }, now),
    ).rejects.toMatchObject({ code: "features/experiment/invalid" });
  });

  it("preserves explicit anonymous login switching and rejects conflicting assignment identities", async () => {
    const switchedDefinition = {
      ...definition,
      revision: "anonymous",
      unit: "anonymous",
      loginPolicy: "switch-unit",
    } as const;
    const switched = {
      ...record,
      experimentRevision: "anonymous",
      definition: switchedDefinition,
      definitionHash: experimentHash(switchedDefinition),
    };
    await storeA.register(switched);
    const command = { ...start, experimentRevision: "anonymous" };
    await storeA.command(command, experimentHash(command), now);
    const switchedCandidate = { ...candidate, experimentRevision: "anonymous" };
    expect((await storeA.assign(switchedCandidate, now)).status).toBe("admitted");
    await expect(
      storeB.assign({ ...switchedCandidate, subject: { ...subject, id: "other" } }, now),
    ).rejects.toMatchObject({ code: "features/experiment/conflict" });
    expect(await storeB.getAssignment(candidate.id)).toEqual(switchedCandidate);
  });

  it("restores configured runtime revisions after a fresh pool and rechecks pause admission", async () => {
    const runtimeOptions = {
      authorization: { authorize: () => true },
      clock: { now: () => new Date(now) },
    };
    const registration = {
      definition,
      handlers: { control: () => false, treatment: () => true },
      eligibility: () => ({ status: "eligible" as const }),
    };
    const runtime = new ExperimentRuntime({ ...runtimeOptions, store: storeA });
    await runtime.register(registration, scope, "operator");
    runtime.registerEligibility("returning", () => ({ status: "eligible" }));
    const nextDefinition = {
      ...definition,
      revision: "v2",
      eligibility: "returning",
      variants: [
        { id: "control", value: false, weight: 1000 },
        { id: "treatment", value: true, weight: 9000 },
      ],
    };
    await runtime.configure({
      ...start,
      action: "configure",
      definition: nextDefinition,
      idempotencyKey: "configure-runtime",
    });
    await runtime.start({ ...start, experimentRevision: "v2" });
    const input = {
      experimentId: definition.id,
      experimentRevision: "v2",
      scope,
      subject,
      actor: "operator",
    };
    const original = await runtime.assign(input);
    expect(original.status).toBe("assigned");
    await poolB.end();
    poolB = new Pool({ connectionString, max: 2 });
    storeB = new DrizzleExperimentStore(database(poolB));
    const restarted = new ExperimentRuntime({ ...runtimeOptions, store: storeB });
    await restarted.register(registration, scope, "operator");
    restarted.registerEligibility("returning", () => ({ status: "eligible" }));
    const restored = await restarted.restore(record, "operator");
    expect(restored.map((item) => item.experimentRevision)).toEqual(["v1", "v2"]);
    expect(await restarted.assign(input)).toEqual(original);
    await restarted.pause({ ...pause, experimentRevision: "v2" });
    expect((await restarted.assign(input)).status).toBe("not_assigned");
    if (original.status !== "assigned") throw new Error("Expected an assignment before pause");
    expect(await storeB.getAssignment(original.assignment.id)).toEqual(original.assignment);
  });

  it("enforces the admission window at the database boundary", async () => {
    const scheduled = {
      ...definition,
      revision: "timed",
      startsAt: "2026-10-03T00:00:00.000Z",
      endsAt: "2026-10-04T00:00:00.000Z",
    };
    const timed = {
      ...record,
      experimentRevision: scheduled.revision,
      definition: scheduled,
      definitionHash: experimentHash(scheduled),
    };
    await storeA.register(timed);
    const command = { ...start, experimentRevision: scheduled.revision };
    await storeA.command(command, experimentHash(command), now);
    const assignment = {
      ...candidate,
      id: "timed-assignment",
      experimentRevision: scheduled.revision,
    };
    expect((await storeA.assign(assignment, now)).status).toBe("not_assigned");
    expect((await storeA.assign(assignment, scheduled.startsAt)).status).toBe("admitted");
    expect((await storeA.admit(assignment.id, scope, subject, scheduled.endsAt)).status).toBe(
      "not_assigned",
    );
  });
  it("preserves code template lineage across workers, cascades, and connection restart", async () => {
    const options = {
      authorization: { authorize: () => true },
      clock: { now: () => new Date(now) },
    };
    const first = new ExperimentRuntime({ ...options, store: storeA });
    const peer = new ExperimentRuntime({ ...options, store: storeB });
    const secondDefinition = { ...definition, revision: "code-v2" };
    const registerTemplates = async (runtime: ExperimentRuntime) => {
      await runtime.register(
        {
          definition,
          eligibility: () => ({ status: "eligible" }),
          handlers: { control: () => "first-code", treatment: () => "first-code" },
        },
        scope,
        "operator",
      );
      await runtime.register(
        {
          definition: secondDefinition,
          eligibility: () => ({ status: "eligible" }),
          handlers: { control: () => "second-code", treatment: () => "second-code" },
        },
        scope,
        "operator",
      );
    };
    await registerTemplates(first);
    await registerTemplates(peer);
    const configured = { ...secondDefinition, revision: "configured-v3" };
    await first.configure({
      ...start,
      experimentRevision: "code-v2",
      action: "configure",
      definition: configured,
    });
    await first.start({ ...start, experimentRevision: configured.revision });
    const input = { ...start, experimentRevision: configured.revision, subject };
    const assigned = await first.assign(input);
    if (assigned.status !== "assigned") throw new Error("Expected assignment");
    expect(await peer.treat({ ...input, assignmentId: assigned.assignment.id })).toEqual({
      status: "treated",
      value: "second-code",
    });
    expect(await peer.assign(input)).toEqual(assigned);
    const cascade = { ...configured, revision: "configured-v4" };
    await peer.configure({
      ...start,
      experimentRevision: configured.revision,
      expectedRevision: 1,
      idempotencyKey: "cascade",
      action: "configure",
      definition: cascade,
    });
    await first.start({ ...start, experimentRevision: cascade.revision });
    const next = { ...input, experimentRevision: cascade.revision };
    const cascaded = await first.assign(next);
    if (cascaded.status !== "assigned") throw new Error("Expected assignment");
    await poolB.end();
    poolB = new Pool({ connectionString, max: 2 });
    storeB = new DrizzleExperimentStore(database(poolB));
    const restarted = new ExperimentRuntime({ ...options, store: storeB });
    await registerTemplates(restarted);
    expect(
      (await restarted.restore(record, "operator")).map((item) => item.experimentRevision),
    ).toEqual(["v1"]);
    expect(
      (await restarted.restore({ ...record, experimentRevision: "code-v2" }, "operator")).map(
        (item) => item.experimentRevision,
      ),
    ).toEqual(["code-v2", "configured-v3", "configured-v4"]);
    expect(await restarted.treat({ ...next, assignmentId: cascaded.assignment.id })).toEqual({
      status: "treated",
      value: "second-code",
    });
    expect((await storeB.get(next))?.codeRevision).toBe("code-v2");
    await expect(storeB.register({ ...record, codeRevision: "code-v2" })).rejects.toThrow(
      "immutable",
    );
    const forgedDefinition = { ...definition, revision: "forged" };
    await expect(
      storeB.configure(
        { ...start, action: "configure", definition: forgedDefinition },
        {
          ...record,
          experimentRevision: "forged",
          definition: forgedDefinition,
          definitionHash: experimentHash(forgedDefinition),
          codeRevision: "code-v2",
        },
        "forged",
        now,
      ),
    ).rejects.toThrow("same experiment and scope");
  });
});
