import { describe, expect, it } from "vitest";
import {
  InMemoryMissionStore,
  MissionService,
  ServerActionVerifier,
  MissionAccessDeniedProblem,
  MissionConflictProblem,
  MissionInvalidProblem,
  missionLocalDate,
  missionPeriod,
  validateMissionDefinition,
} from "../index";
import type { MissionDefinition, MissionScope, MissionCommand, MissionEvidence } from "../index";
const scope: MissionScope = { appId: "app", environmentId: "test", tenantId: "tenant" };
const definition: MissionDefinition = {
  id: "save",
  version: 1,
  actionId: "save-result",
  countMode: "events",
  unit: "event",
  timezone: "America/New_York",
  period: "week",
  anchor: "2026-03-02",
  target: 3,
  perPeriodCap: 5,
  lateAcceptanceMs: 3600000,
  closedCorrection: "recalculate",
};
const command: MissionCommand = {
  actor: { id: "user" },
  key: {
    scope,
    subjectId: "user",
    missionId: "save",
    version: 1,
    episodeId: "first",
    periodKey: "2026-03-02",
  },
};

describe("Mission storage bounds", () => {
  it("keeps reversal capacity after the original receipt limit", async () => {
    const { service, store } = await fixture({ target: 10000, perPeriodCap: 10000 });
    await service.ingestEvidence({
      ...command,
      evidence: { eventId: "0", actionId: definition.actionId, occurredAt: "2026-03-03T15:00:00Z" },
    });
    await store.transaction(command.key, (aggregate) => {
      if (!aggregate) throw new MissionInvalidProblem("Fixture aggregate missing");
      const receipt = aggregate.receipts["0"];
      for (let index = 1; index < 10000; index++)
        aggregate.receipts[String(index)] = { ...receipt, eventId: String(index) };
      const instance = aggregate.instances[command.key.periodKey];
      instance.progress = 10000;
      instance.state = "achieved";
      const completion = {
        id: "historical",
        periodKey: command.key.periodKey,
        achievedAt: receipt.acceptedAt,
        eventId: "9999",
      };
      instance.completion = completion;
      aggregate.completions[command.key.periodKey] = completion;
      return { aggregate, result: undefined };
    });
    const corrected = await service.ingestEvidence({
      ...command,
      evidence: {
        eventId: "reversal",
        actionId: definition.actionId,
        occurredAt: "2026-03-08T15:00:00Z",
        reversalOf: "0",
      },
    });
    expect(corrected.progress.instance.progress).toBe(9999);
    expect(corrected.progress.instance.state).toBe("active");
    expect(corrected.progress.instance.completion?.id).toBe("historical");
    expect(corrected.receipt.reversalOf).toBe("0");
    await expect(
      service.ingestEvidence({
        ...command,
        evidence: {
          eventId: "overflow",
          actionId: definition.actionId,
          occurredAt: "2026-03-08T15:00:00Z",
        },
      }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
  });
  it("rejects versions and revisions outside PostgreSQL integer range", async () => {
    expect(() => validateMissionDefinition({ ...definition, version: 2147483648 })).toThrow(
      MissionInvalidProblem,
    );
    const { service } = await fixture();
    await expect(
      service.publishDefinition({
        actor: command.actor,
        publication: {
          scope,
          definition: { ...definition, version: 2 },
          actorId: command.actor.id,
          reason: "Invalid revision",
          revision: 2147483648,
          idempotencyKey: "overflow",
          publishedAt: "2026-03-01T00:00:00Z",
        },
      }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
  });
});
async function fixture(overrides: Partial<MissionDefinition> = {}) {
  const store = new InMemoryMissionStore();
  let now = new Date("2026-03-08T20:00:00Z");
  const options = {
    store,
    authorization: { authorize: async () => true },
    verifier: { verify: async () => true },
    clock: () => now,
  };
  const service = new MissionService(options);
  await service.publishDefinition({
    actor: command.actor,
    publication: {
      scope,
      definition: { ...definition, ...overrides },
      actorId: "user",
      reason: "Initial mission",
      revision: 1,
      idempotencyKey: "publish-1",
      publishedAt: "2026-03-01T00:00:00Z",
    },
  });
  return {
    service,
    store,
    options,
    setNow: (value: string) => {
      now = new Date(value);
    },
  };
}
const evidence = (eventId: string, occurredAt = "2026-03-03T15:00:00Z"): MissionEvidence => ({
  eventId,
  actionId: "save-result",
  occurredAt,
});
describe("MissionService", () => {
  it.each([{ version: 2 }, { episodeId: "return" }, { periodKey: "2026-03-09" }])(
    "rolls back event ownership conflicts across keys %j",
    async (keyChange) => {
      const { service, store } = await fixture();
      await service.ingestEvidence({ ...command, evidence: evidence("owned") });
      const original = await store.read(command.key);
      if (!original) throw new MissionInvalidProblem("Test aggregate missing");
      const otherKey = { ...command.key, ...keyChange };
      await expect(
        store.transaction(otherKey, () => ({
          aggregate: { ...original, key: otherKey },
          result: undefined,
        })),
      ).rejects.toBeInstanceOf(MissionConflictProblem);
      expect(await store.read(otherKey)).toBeUndefined();
      expect(await store.read(command.key)).toEqual(original);
      expect(
        (await service.ingestEvidence({ ...command, evidence: evidence("owned") })).duplicate,
      ).toBe(true);
    },
  );
  it("requires exact publication replay including the original timestamp", async () => {
    const { service, store } = await fixture();
    const publication = await store.getDefinition(scope, definition.id, definition.version);
    if (!publication) throw new MissionInvalidProblem("Test publication missing");
    expect(await service.publishDefinition({ actor: command.actor, publication })).toEqual(
      publication,
    );
    await expect(
      service.publishDefinition({
        actor: command.actor,
        publication: { ...publication, publishedAt: "2026-03-02T00:00:00Z" },
      }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    expect(await store.getDefinition(scope, definition.id, definition.version)).toEqual(
      publication,
    );
  });

  it.each([undefined, null])(
    "rejects absent runtime boundaries as Mission Problems (%s)",
    async (missing) => {
      const { service } = await fixture();
      const invalidCommand = missing as unknown as MissionCommand;
      await expect(service.getProgress(invalidCommand)).rejects.toBeInstanceOf(
        MissionInvalidProblem,
      );
      await expect(service.closePeriod(invalidCommand)).rejects.toBeInstanceOf(
        MissionInvalidProblem,
      );
      await expect(
        service.getProgress({ ...command, key: missing as unknown as MissionCommand["key"] }),
      ).rejects.toBeInstanceOf(MissionInvalidProblem);
      await expect(
        service.getProgress({ ...command, actor: missing as unknown as MissionCommand["actor"] }),
      ).rejects.toBeInstanceOf(MissionInvalidProblem);
      await expect(
        service.ingestEvidence({ ...command, evidence: missing as unknown as MissionEvidence }),
      ).rejects.toBeInstanceOf(MissionInvalidProblem);
      type PublishInput = Parameters<MissionService["publishDefinition"]>[0];
      await expect(
        service.publishDefinition(missing as unknown as PublishInput),
      ).rejects.toBeInstanceOf(MissionInvalidProblem);
      await expect(
        service.publishDefinition({
          actor: command.actor,
          publication: missing as unknown as PublishInput["publication"],
        }),
      ).rejects.toBeInstanceOf(MissionInvalidProblem);
    },
  );
  it("rejects invalid clocks and extra evidence payload", async () => {
    const { options } = await fixture();
    const service = new MissionService({ ...options, clock: () => new Date("invalid") });
    await expect(
      service.ingestEvidence({ ...command, evidence: evidence("clock") }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
    await expect(service.closePeriod(command)).rejects.toBeInstanceOf(MissionInvalidProblem);
    const extra = { ...evidence("extra"), clientCompletion: 100 };
    await expect(
      new MissionService(options).ingestEvidence({ ...command, evidence: extra }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
  });

  it("counts events separately from distinct days, deduplicates and caps", async () => {
    for (const mode of ["events", "distinct-days"] as const) {
      const { service } = await fixture({
        countMode: mode,
        unit: mode === "events" ? "event" : "day",
        perPeriodCap: 3,
      });
      for (const id of ["1", "2", "3", "4"])
        await service.ingestEvidence({ ...command, evidence: evidence(id) });
      const duplicate = await service.ingestEvidence({ ...command, evidence: evidence("1") });
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.progress.instance.progress).toBe(mode === "events" ? 3 : 1);
      await expect(
        service.ingestEvidence({ ...command, evidence: evidence("1", "2026-03-04T15:00:00Z") }),
      ).rejects.toBeInstanceOf(MissionConflictProblem);
    }
  });
  it("pins activity dates through DST and completes exactly once under final-evidence races", async () => {
    const { service } = await fixture({ countMode: "distinct-days", unit: "day" });
    await service.ingestEvidence({ ...command, evidence: evidence("1", "2026-03-06T15:00:00Z") });
    await service.ingestEvidence({ ...command, evidence: evidence("2", "2026-03-07T15:00:00Z") });
    const results = await Promise.all(
      ["3", "4"].map((id) =>
        service.ingestEvidence({ ...command, evidence: evidence(id, "2026-03-08T15:00:00Z") }),
      ),
    );
    expect(results.filter((result) => result.completionCreated)).toHaveLength(1);
    expect(results[1]?.progress.instance.activityDates).toEqual([
      "2026-03-06",
      "2026-03-07",
      "2026-03-08",
    ]);
    expect(missionLocalDate("2026-03-08T04:59:59Z", definition.timezone)).toBe("2026-03-07");
    expect(missionLocalDate("2026-03-08T05:00:00Z", definition.timezone)).toBe("2026-03-08");
  });
  it("measures longest consecutive local-day run within the pinned period", async () => {
    const { service } = await fixture({ countMode: "streak", unit: "day" });
    for (const day of ["02", "04", "05", "06"])
      await service.ingestEvidence({
        ...command,
        evidence: evidence(day, `2026-03-${day}T15:00:00Z`),
      });
    expect((await service.getProgress(command)).instance.progress).toBe(3);
  });
  it("retains correction and completion history across service restarts without claiming current success", async () => {
    const { service, options } = await fixture();
    for (const id of ["1", "2", "3"])
      await service.ingestEvidence({ ...command, evidence: evidence(id) });
    const restarted = new MissionService(options);
    const result = await restarted.ingestEvidence({
      ...command,
      evidence: { ...evidence("undo"), reversalOf: "1" },
    });
    expect(result.progress.instance.progress).toBe(2);
    expect(result.progress.instance.state).toBe("active");
    expect(result.progress.instance.completion).toBeDefined();
    expect(result.completionCreated).toBe(false);
    await expect(
      restarted.ingestEvidence({
        ...command,
        evidence: { ...evidence("undo-again"), reversalOf: "1" },
      }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
  });
  it("enforces late acceptance and close boundaries in the period timezone", async () => {
    const { service, setNow } = await fixture();
    await expect(service.closePeriod(command)).rejects.toBeInstanceOf(MissionConflictProblem);
    setNow("2026-03-09T04:30:00Z");
    await service.ingestEvidence({ ...command, evidence: evidence("late") });
    setNow("2026-03-09T05:00:00Z");
    await service.closePeriod(command);
    await expect(
      service.ingestEvidence({ ...command, evidence: evidence("closed") }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    const corrected = await service.ingestEvidence({
      ...command,
      evidence: { ...evidence("undo"), reversalOf: "late" },
    });
    expect(corrected.progress.instance.progress).toBe(0);
    expect(corrected.progress.instance.state).toBe("closed");
  });
  it.each(["reject", "record-only"] as const)(
    "applies explicit %s closed correction policy",
    async (policy) => {
      const { service, setNow } = await fixture({ closedCorrection: policy });
      await service.ingestEvidence({ ...command, evidence: evidence("one") });
      setNow("2026-03-09T06:00:00Z");
      await service.closePeriod(command);
      const correction = service.ingestEvidence({
        ...command,
        evidence: { ...evidence("undo"), reversalOf: "one" },
      });
      if (policy === "reject")
        await expect(correction).rejects.toBeInstanceOf(MissionConflictProblem);
      else {
        const result = await correction;
        expect(result.receipt.effect).toBe("record-only");
        expect(result.progress.instance.progress).toBe(1);
      }
    },
  );
  it("does not allow replayed activity to become a new instance under another timezone/version", async () => {
    const { service } = await fixture();
    await service.ingestEvidence({ ...command, evidence: evidence("one") });
    await service.publishDefinition({
      actor: command.actor,
      publication: {
        scope,
        definition: { ...definition, version: 2, timezone: "Asia/Seoul" },
        actorId: "user",
        reason: "Return episode",
        revision: 2,
        idempotencyKey: "publish-2",
        publishedAt: "2026-03-02T00:00:00Z",
      },
    });
    await expect(
      service.ingestEvidence({
        ...command,
        key: { ...command.key, version: 2, episodeId: "return" },
        evidence: evidence("one"),
      }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    expect((await service.getProgress(command)).definition.timezone).toBe("America/New_York");
    expect(
      (await service.getProgress({ ...command, key: { ...command.key, periodKey: "2026-03-09" } }))
        .instance.state,
    ).toBe("active");
  });
  it("validates dates, modes, missing tenants and period identity", async () => {
    expect(() => validateMissionDefinition({ ...definition, anchor: "2026-02-30" })).toThrow(
      MissionInvalidProblem,
    );
    expect(() => validateMissionDefinition({ ...definition, unit: "day" })).toThrow(
      MissionInvalidProblem,
    );
    expect(missionPeriod(definition, "2026-03-08").periodKey).toBe("2026-03-02");
    const { service } = await fixture();
    await expect(
      service.getProgress({
        ...command,
        key: { ...command.key, scope: { ...scope, tenantId: "" } },
      }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
    await expect(
      service.ingestEvidence({ ...command, evidence: evidence("wrong", "2026-03-01T15:00:00Z") }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
  });
  it("rejects unauthorized reads and propagates provider failures", async () => {
    const { options } = await fixture();
    const denied = new MissionService({
      ...options,
      authorization: { authorize: async () => false },
    });
    await expect(denied.getProgress(command)).rejects.toBeInstanceOf(MissionAccessDeniedProblem);
    options.store.read = async () => {
      throw new MissionConflictProblem("Provider unavailable");
    };
    await expect(new MissionService(options).getProgress(command)).rejects.toThrow(
      "Provider unavailable",
    );
  });
  it("treats arbitrary event identifiers as own properties", async () => {
    const { service } = await fixture();
    for (const eventId of ["__proto__", "constructor", "toString"]) {
      const result = await service.ingestEvidence({ ...command, evidence: evidence(eventId) });
      expect(result.duplicate).toBe(false);
      expect(
        (await service.ingestEvidence({ ...command, evidence: evidence(eventId) })).duplicate,
      ).toBe(true);
    }
    expect((await service.getProgress(command)).instance.progress).toBe(3);
  });
  it("rejects late events before explicit close and future evidence", async () => {
    const { service, setNow } = await fixture();
    await expect(
      service.ingestEvidence({ ...command, evidence: evidence("future", "2026-03-08T21:00:00Z") }),
    ).rejects.toBeInstanceOf(MissionInvalidProblem);
    setNow("2026-03-09T05:00:00.001Z");
    await expect(
      service.ingestEvidence({ ...command, evidence: evidence("late") }),
    ).rejects.toBeInstanceOf(MissionConflictProblem);
    expect((await service.getProgress(command)).instance.progress).toBe(0);
  });
  it("verifies server ledger evidence, subject and episode provenance", async () => {
    const item = evidence("one");
    const receipt = {
      ...item,
      scope,
      subjectId: "user",
      missionId: "save",
      version: 1,
      episodeId: "first",
    };
    const verifier = new ServerActionVerifier({ find: async () => receipt });
    expect(await verifier.verify({ key: command.key, evidence: item })).toBe(true);
    expect(await verifier.verify({ key: { ...command.key, version: 2 }, evidence: item })).toBe(
      false,
    );
    expect(
      await verifier.verify({
        key: { ...command.key, scope: { ...scope, tenantId: "other" } },
        evidence: item,
      }),
    ).toBe(false);
    expect(
      await verifier.verify({ key: command.key, evidence: { ...item, actionId: "forged" } }),
    ).toBe(false);

    expect(
      await verifier.verify({ key: { ...command.key, subjectId: "other" }, evidence: item }),
    ).toBe(false);
    expect(
      await verifier.verify({ key: { ...command.key, episodeId: "return" }, evidence: item }),
    ).toBe(false);
    expect(
      await verifier.verify({
        key: command.key,
        evidence: { ...item, occurredAt: "2026-03-04T15:00:00Z" },
      }),
    ).toBe(false);
  });
});
