import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { PolicyReleaseService } from "@croco/features-core";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  DrizzlePolicyReleaseStore,
  createFeaturesSchema,
  dropFeaturesSchema,
  policyCommandFingerprint,
  type FeaturePolicyPgDatabase,
  type PolicyRevision,
} from "../index";

const connectionString = process.env.FEATURES_POSTGRES_URL ?? "";
const scope = { app: "banner", environment: "test", tenantId: "tenant-1" } as const;
const reviewedAt = "2026-09-29T11:00:00.000Z";

type Banner = { message: string };

function database(pool: Pool): FeaturePolicyPgDatabase {
  return drizzle(pool) as unknown as FeaturePolicyPgDatabase;
}

function revision(
  revisionNumber: number,
  state: PolicyRevision<Banner>["state"] = "draft",
): PolicyRevision<Banner> {
  return {
    id: `banner-${revisionNumber}`,
    policyId: "banner-copy",
    scope,
    schemaVersion: "1",
    codeRegistrationId: "banner-copy-v1",
    registrationFingerprint: "sha256:registration",
    revision: revisionNumber,
    version: revisionNumber,
    value: { message: `message-${revisionNumber}` },
    hash: `sha256:value-${revisionNumber}`,
    state,
    ...(state === "reviewed"
      ? {
          review: {
            reviewedRevision: revisionNumber,
            reviewedHash: `sha256:review-${revisionNumber}`,
            reviewedValue: { message: `message-${revisionNumber}` },
            validation: { valid: true, diagnostics: [] },
            semanticDiff: [],
            reviewedAt,
            actor: { id: "reviewer" },
            reason: "Review",
          },
        }
      : {}),
    history: [],
  };
}

describe.skipIf(connectionString.length === 0)("DrizzlePolicyReleaseStore PostgreSQL", () => {
  let poolA: Pool;
  let poolB: Pool;
  let storeA: DrizzlePolicyReleaseStore<Banner>;
  let storeB: DrizzlePolicyReleaseStore<Banner>;

  beforeAll(async () => {
    poolA = new Pool({ connectionString, max: 4 });
    poolB = new Pool({ connectionString, max: 4 });
    await createFeaturesSchema(database(poolA));
  });

  beforeEach(async () => {
    await poolA.query(
      "truncate table croco_feature_policy_audit, croco_feature_policy_decisions, croco_feature_policy_schedules, croco_feature_policy_command_receipts, croco_feature_policy_activations, croco_feature_policy_reviews, croco_feature_policy_heads, croco_feature_policy_revisions, croco_feature_policy_definitions cascade",
    );
    storeA = new DrizzlePolicyReleaseStore(database(poolA));
    storeB = new DrizzlePolicyReleaseStore(database(poolB));
  });

  afterAll(async () => {
    await dropFeaturesSchema(database(poolA));
    await poolA.end();
    await poolB.end();
  });

  it("reports a stable conflict when two connections create the same policy", async () => {
    const draft = revision(1);
    const definition = {
      policyId: draft.policyId,
      scope,
      schemaVersion: draft.schemaVersion,
      codeRegistrationId: draft.codeRegistrationId,
      registrationFingerprint: draft.registrationFingerprint,
    };
    const results = await Promise.allSettled([
      storeA.create(draft, definition),
      storeB.create(draft, definition),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" ? rejected.reason : undefined).toMatchObject({
      code: "features/policy/revision-conflict",
    });
  });

  it("stores the latest definition without changing historical registration bindings", async () => {
    const first = revision(1);
    const definition = {
      policyId: first.policyId,
      scope,
      schemaVersion: first.schemaVersion,
      codeRegistrationId: first.codeRegistrationId,
      registrationFingerprint: first.registrationFingerprint,
    };
    await storeA.create(first, definition);
    const next = {
      ...revision(2),
      schemaVersion: "2",
      codeRegistrationId: "banner-v2",
      registrationFingerprint: "sha256:v2",
    };
    await storeA.create(next, {
      ...definition,
      schemaVersion: next.schemaVersion,
      codeRegistrationId: next.codeRegistrationId,
      registrationFingerprint: next.registrationFingerprint,
    });
    expect(await storeB.getRevision(scope, first.policyId, 1)).toEqual(first);
    expect(
      (await poolA.query("select schema_version from croco_feature_policy_definitions")).rows[0]
        .schema_version,
    ).toBe("2");
  });

  it("serializes two connection revision writes with scope head CAS", async () => {
    await storeA.create(revision(1));
    const left = revision(2);
    const right = { ...revision(2), id: "banner-2-right", value: { message: "right" } };
    const results = await Promise.allSettled([storeA.save(left, 1), storeB.save(right, 1)]);

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(await storeA.get(scope, "banner-copy")).toMatchObject({ revision: 2 });
  });

  it("deduplicates the same command and keeps one activation row under concurrent publish", async () => {
    const reviewed = revision(1, "reviewed");
    await storeA.create(reviewed);
    const command = {
      policyId: reviewed.policyId,
      scope,
      expectedRevision: reviewed.revision,
      reviewHash: reviewed.review?.reviewedHash as string,
      actor: { id: "operator" },
      reason: "Publish",
      idempotencyKey: "publish-1",
    };
    const published = { ...reviewed, ...revision(2, "published"), review: reviewed.review };
    const receipt = {
      id: "receipt-1",
      policyId: reviewed.policyId,
      scope,
      revision: published.revision,
      version: published.version,
      hash: published.hash,
      status: "published" as const,
      idempotencyKey: command.idempotencyKey,
      commandFingerprint: policyCommandFingerprint(command),
      effectiveAt: "2026-09-29T12:00:00.000Z",
      recordedAt: "2026-09-29T12:00:00.000Z",
    };
    const input = { revision: published, command, receipt };
    await poolA.query(
      "alter table croco_feature_policy_audit add constraint reject_publication check (action <> 'publish')",
    );
    await expect(storeA.recordPublication(input)).rejects.toThrow();
    expect(await storeA.get(scope, reviewed.policyId)).toEqual(reviewed);
    expect(
      await storeA.findCommandReceipt(scope, reviewed.policyId, command.idempotencyKey),
    ).toBeNull();
    expect(
      (await poolA.query("select count(*) from croco_feature_policy_activations")).rows[0].count,
    ).toBe("0");
    await poolA.query("alter table croco_feature_policy_audit drop constraint reject_publication");
    const results = await Promise.allSettled([
      storeA.recordPublication(input),
      storeB.recordPublication(input),
    ]);
    expect(results.every((result) => result.status === "fulfilled")).toBe(true);
    expect(
      await storeA.findCommandReceipt(scope, reviewed.policyId, command.idempotencyKey),
    ).toEqual(receipt);
    expect(
      (await poolA.query("select count(*) from croco_feature_policy_activations")).rows[0].count,
    ).toBe("1");
    expect(await storeA.getRevision(scope, reviewed.policyId, 1)).toEqual(reviewed);
    expect(await storeA.get(scope, reviewed.policyId)).toEqual(published);
    expect(await storeA.listAudit(reviewed.policyId, scope)).toHaveLength(1);
    await expect(
      storeB.recordPublication({
        ...input,
        receipt: { ...receipt, commandFingerprint: "different" },
      }),
    ).rejects.toMatchObject({ code: "features/policy/idempotency-conflict" });
  });

  it("restores scheduled commands across new connections and cancels them through the core service", async () => {
    let now = new Date("2026-09-29T11:00:00.000Z");
    const createService = (store: DrizzlePolicyReleaseStore<unknown>) => {
      const service = new PolicyReleaseService({ store, clock: { now: () => now } });
      service.registerPolicy({
        id: "banner-copy",
        schemaVersion: "1",
        codeRegistrationId: "banner-copy-v1",
        schema: { version: "1", validate: (value) => typeof value === "string" },
        fieldDescriptors: [
          {
            id: "copy",
            label: "Copy",
            input: "text",
            read: (value) => value,
            write: (_value, next) => next,
          },
        ],
        evaluate: (value) => value,
      });
      return service;
    };
    const target = { policyId: "banner-copy", scope, actor: { id: "operator" }, reason: "Launch" };
    const service = createService(
      new DrizzlePolicyReleaseStore(database(poolA), { now: () => now }),
    );
    const draft = await service.createDraft({ ...target, value: "Hello" });
    const reviewed = await service.review({ ...target, expectedRevision: draft.revision });
    const scheduled = await service.schedule({
      ...target,
      expectedRevision: reviewed.revision,
      reviewHash: reviewed.hash,
      effectiveAt: "2026-09-29T12:00:00.000Z",
      idempotencyKey: "schedule",
    });
    now = new Date("2026-09-29T12:01:00.000Z");
    await poolB.end();
    poolB = new Pool({ connectionString, max: 4 });
    const restoredStore = new DrizzlePolicyReleaseStore(database(poolB), { now: () => now });
    const restoredService = createService(restoredStore);
    const rows = await restoredStore.listDueSchedules(now);
    expect(rows).toHaveLength(1);
    expect(rows[0].revision).toBe(scheduled.revision);
    const command = rows[0].metadata?.command as Parameters<typeof restoredService.publish>[0];
    const published = await restoredService.publish(command);
    expect(await restoredService.publish(command)).toEqual(published);
    expect(await restoredService.resolve({ policyId: target.policyId, scope })).toMatchObject({
      status: "active",
      value: "Hello",
    });

    const nextDraft = await restoredService.createDraft({ ...target, value: "Unpublished draft" });
    const pauseCommand = {
      ...target,
      expectedRevision: nextDraft.revision,
      idempotencyKey: "pause",
    };
    const [paused, concurrentPause] = await Promise.all([
      restoredService.pause(pauseCommand),
      service.pause(pauseCommand),
    ]);
    expect(concurrentPause).toEqual(paused);
    expect(await restoredService.pause(pauseCommand)).toEqual(paused);
    expect(await restoredStore.resolve(scope, target.policyId, now)).toMatchObject({
      status: "unavailable",
      reason: "Launch",
    });
    expect(await restoredService.resolve({ policyId: target.policyId, scope })).toMatchObject({
      status: "unavailable",
    });
    const retained = await restoredStore.get(scope, target.policyId);
    expect(retained).toMatchObject({
      state: "draft",
      value: "Unpublished draft",
      revision: paused.revision + 1,
    });
    expect(
      await restoredStore.getRevision(scope, target.policyId, nextDraft.revision),
    ).toMatchObject({ state: "draft", value: "Unpublished draft" });

    const secondTarget = { ...target, scope: { ...scope, tenantId: "cancelled" } };
    const secondDraft = await restoredService.createDraft({ ...secondTarget, value: "Cancelled" });
    const secondReview = await restoredService.review({
      ...secondTarget,
      expectedRevision: secondDraft.revision,
    });
    const secondSchedule = await restoredService.schedule({
      ...secondTarget,
      expectedRevision: secondReview.revision,
      reviewHash: secondReview.hash,
      effectiveAt: "2026-09-29T13:00:00.000Z",
      idempotencyKey: "cancel",
    });
    await restoredService.cancelSchedule({
      ...secondTarget,
      expectedRevision: secondSchedule.revision,
    });
    expect(
      (
        await poolA.query(
          "select state from croco_feature_policy_schedules where idempotency_key='cancel:publish'",
        )
      ).rows[0].state,
    ).toBe("cancelled");
    now = new Date("2026-09-29T14:00:00.000Z");
    expect(
      (await restoredStore.listDueSchedules(now)).every(
        (row) => row.scope.tenantId !== "cancelled",
      ),
    ).toBe(true);
    expect(
      await restoredStore.resolve(secondTarget.scope, secondTarget.policyId, now),
    ).toMatchObject({
      status: "unavailable",
    });
  });

  it("resolves publication and pause history at their effective instants", async () => {
    let now = new Date("2026-09-29T00:00:00.000Z");
    const store = new DrizzlePolicyReleaseStore<string>(database(poolA), { now: () => now });
    const service = new PolicyReleaseService({ store, clock: { now: () => now } });
    service.registerPolicy<string>({
      id: "timeline",
      schemaVersion: "1",
      codeRegistrationId: "timeline-v1",
      schema: { version: "1", validate: (value) => typeof value === "string" },
      fieldDescriptors: [],
      evaluate: (value) => value,
    });
    const target = { policyId: "timeline", scope, actor: { id: "operator" }, reason: "Timeline" };
    const draft = await service.createDraft({ ...target, value: "first" });
    const review = await service.review({ ...target, expectedRevision: draft.revision });
    const published = await service.publish({
      ...target,
      expectedRevision: review.revision,
      reviewHash: review.hash,
      idempotencyKey: "first",
    });
    now = new Date("2026-09-29T01:00:00.000Z");
    const paused = await service.pause({
      ...target,
      expectedRevision: published.revision,
      idempotencyKey: "pause",
    });
    now = new Date("2026-09-29T02:00:00.000Z");
    await service.rollback({
      ...target,
      expectedRevision: paused.revision,
      toVersion: published.version,
      idempotencyKey: "rollback",
      effectiveAt: "2026-09-28T23:00:00.000Z",
    });
    expect(
      await store.resolve(scope, target.policyId, new Date("2026-09-29T00:30:00.000Z")),
    ).toMatchObject({ status: "active", version: published.version });
    expect(
      await store.resolve(scope, target.policyId, new Date("2026-09-29T01:30:00.000Z")),
    ).toMatchObject({ status: "unavailable", version: paused.version, reason: "Timeline" });
    expect(await store.resolve(scope, target.policyId, now)).toMatchObject({
      status: "active",
      value: "first",
    });
  });

  it("preserves a code-declared null fallback after reopening the store", async () => {
    const now = new Date("2026-09-29T12:00:00.000Z");
    const store = new DrizzlePolicyReleaseStore<string | null>(database(poolA), { now: () => now });
    const service = new PolicyReleaseService({ store, clock: { now: () => now } });
    service.registerPolicy<string | null>({
      id: "nullable-fallback",
      schemaVersion: "1",
      codeRegistrationId: "nullable-v1",
      schema: { version: "1", validate: (value) => value === null || typeof value === "string" },
      fieldDescriptors: [],
      fallback: null,
      evaluate: (value) => value,
    });
    const target = {
      policyId: "nullable-fallback",
      scope,
      actor: { id: "operator" },
      reason: "Safe pause",
    };
    const draft = await service.createDraft({ ...target, value: "active" });
    const reviewed = await service.review({ ...target, expectedRevision: draft.revision });
    const published = await service.publish({
      ...target,
      expectedRevision: reviewed.revision,
      reviewHash: reviewed.hash,
      idempotencyKey: "publish-nullable",
    });
    const paused = await service.pause({
      ...target,
      expectedRevision: published.revision,
      idempotencyKey: "pause-nullable",
    });
    const restored = new DrizzlePolicyReleaseStore<string | null>(database(poolB));
    expect(await restored.getRevision(scope, target.policyId, paused.revision)).toMatchObject({
      fallback: null,
    });
    expect(await restored.resolve(scope, target.policyId, now)).toMatchObject({
      status: "paused",
      value: null,
      reason: "Safe pause",
    });
  });

  it("allows one due schedule claim and recovers it after the lease expires", async () => {
    const reviewed = revision(1, "reviewed");
    await storeA.create(reviewed);
    const scheduled = await storeA.schedule({
      policyId: reviewed.policyId,
      scope,
      revision: reviewed.revision,
      reviewHash: reviewed.review?.reviewedHash as string,
      effectiveAt: "2026-09-29T12:00:00.000Z",
      idempotencyKey: "schedule-1",
    });
    const now = new Date("2026-09-29T12:01:00.000Z");
    const [first, second] = await Promise.all([
      storeA.claimSchedule(scheduled.id, "worker-a", now, 1_000),
      storeB.claimSchedule(scheduled.id, "worker-b", now, 1_000),
    ]);
    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(
      await storeB.claimSchedule(
        scheduled.id,
        "worker-b",
        new Date("2026-09-29T12:02:00.000Z"),
        1_000,
      ),
    ).not.toBeNull();
  });
});
