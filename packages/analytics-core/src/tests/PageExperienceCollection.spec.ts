import { describe, expect, it } from "vitest";
import { calculatePageExperience } from "@croco/metrics-core";
import type { PageExperienceDefinition, PageExperienceRow } from "@croco/metrics-core";
import {
  PageExperienceCollection,
  PageExperienceCollectionProblem,
} from "../libs/PageExperienceCollection";
import type { PageExperienceCollectionContext } from "../libs/PageExperienceCollection";
const context: PageExperienceCollectionContext = {
  scope: { app: "shop", environment: "test", tenant: "t" },
  subject: "server-subject",
  session: "server-session",
  origin: "https://shop.test",
  consent: true,
  collectionAllowed: true,
};
function fixture() {
  const rows: PageExperienceRow[] = [];
  let now = new Date("2026-01-01T00:00:01.000Z");
  let authorized = true,
    committed = false,
    fail = false;
  let receipt = {
    id: "receipt-1",
    source: "billing",
    occurredAt: "2026-01-01T00:00:00.000Z",
    action: "purchase",
    pageInstance: "p1",
    page: "product",
  };
  const definition: PageExperienceDefinition = {
    id: "pdp",
    version: 1,
    page: "product",
    contentCondition: "hero",
    contentMinIntersectionRatio: 0.5,
    minVisibleMs: 1000,
    engagementActions: ["preview"],
    valueAction: "purchase",
    unit: "session",
    sessionWindowMs: 60000,
    timezone: "UTC",
    hiddenTime: "exclude",
  };
  const service = new PageExperienceCollection({
    definition,
    allowedOrigins: ["https://shop.test"],
    clock: () => now,
    authorize: async () => authorized,
    append: async (row) => {
      if (fail) throw new Error("source failed");
      const prior = rows.find((r) => r.id === row.id && r.source === row.source);
      if (!prior) rows.push(row);
      else if (
        Object.entries(row).some(
          ([key, value]) => key !== "receivedAt" && prior[key as keyof PageExperienceRow] !== value,
        )
      )
        throw new PageExperienceCollectionProblem();
    },
    verifyReceipt: async (ref) => (committed && ref === "receipt-1" ? receipt : null),
  });
  return {
    service,
    definition,
    rows,
    setReceipt: (value: Partial<typeof receipt>) => {
      receipt = { ...receipt, ...value };
    },
    setTime: (value: Date) => {
      now = value;
    },
    setAuthorized: (v: boolean) => {
      authorized = v;
    },
    commit: () => {
      committed = true;
    },
    fail: () => {
      fail = true;
    },
  };
}
const observation = {
  id: "v1",
  pageInstance: "p1",
  page: "product",
  kind: "view",
  occurredAt: "2026-01-01T00:00:00.000Z",
  value: "product",
};
describe("Page experience server collection", () => {
  it("namespaces identical client IDs by authenticated session and subject while keeping retries stable", async () => {
    const { service, rows } = fixture();
    await service.observe(observation, context);
    await service.observe(observation, {
      ...context,
      subject: "second-subject",
      session: "second-session",
    });
    await service.observe(observation, context);
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.id)).size).toBe(2);
    expect(rows.map((row) => row.subject)).toEqual(["server-subject", "second-subject"]);
    expect(rows.every((row) => row.id !== observation.id)).toBe(true);
  });
  it.each(["duplicate-view", "visible-duration"])(
    "keeps a healthy cohort and real receipt readable after accepted %s browser observations",
    async (mode) => {
      const f = fixture();
      await f.service.observe(observation, context);
      if (mode === "duplicate-view")
        await f.service.observe({ ...observation, id: "other-view" }, context);
      else {
        await f.service.observe(
          { ...observation, id: "content", kind: "content", value: "hero" },
          context,
        );
        await f.service.observe(
          { ...observation, id: "duration", kind: "visible", value: "50000" },
          context,
        );
      }
      f.commit();
      expect(await f.service.committed("receipt-1", context)).toBe("recorded");
      const template = f.rows[0];
      expect(template).toBeDefined();
      if (!template) return;
      const session: PageExperienceRow = {
        ...template,
        id: "session",
        kind: "session",
        value: "session",
      };
      const healthySession = {
        ...session,
        id: "healthy-session",
        session: "healthy",
        subject: "healthy",
      };
      const healthyView: PageExperienceRow = {
        ...healthySession,
        id: "healthy-view",
        kind: "view",
        value: "product",
        pageInstance: "healthy",
      };
      const result = await calculatePageExperience({
        scope: context.scope,
        definition: f.definition,
        sourceRef: "history",
        sourceRevision: "r1",
        snapshotRef: "s1",
        window: { from: observation.occurredAt, to: "2026-01-01T00:01:00.000Z" },
        cutoff: "2026-01-01T00:02:00.000Z",
        allowedLatenessMs: 10000,
        completeThrough: "2026-01-01T00:02:00.000Z",
        coverage: "complete",
        deletedSubjects: [],
        rows: [session, healthySession, healthyView, ...f.rows],
      });
      expect(result).toMatchObject({
        viewed: 1,
        confirmedOutcomes: 1,
        unlinkedCommitted: 1,
        invalidInstances: 1,
        unknownSessions: 1,
        bounce: { numerator: 1, denominator: 1 },
      });
    },
  );
  it("binds subject and tenant on server and rejects forged subject, outcome and foreign origin", async () => {
    const { service, rows } = fixture();
    await service.observe(observation, context);
    expect(rows[0]?.subject).toBe("server-subject");
    expect(rows[0]?.session).toBe("server-session");
    for (const body of [
      { ...observation, subject: "attacker" },
      { ...observation, kind: "committed" },
      { ...observation, trace: "fake" },
      { ...observation, value: "email@example.test" },
    ])
      await expect(service.observe(body, context)).rejects.toBeInstanceOf(
        PageExperienceCollectionProblem,
      );
    await expect(
      service.observe(observation, { ...context, origin: "https://other.test" }),
    ).rejects.toBeInstanceOf(PageExperienceCollectionProblem);
    await expect(
      service.observe(observation, {
        ...context,
        scope: { app: "shop", environment: "test" } as PageExperienceCollectionContext["scope"],
      }),
    ).rejects.toBeInstanceOf(PageExperienceCollectionProblem);
  });
  it("requires a real committed receipt, deduplicates replay and exposes telemetry failure without failing domain success", async () => {
    const f = fixture();
    expect(await f.service.committed("receipt-1", context)).toBe("rejected");
    expect(f.rows).toEqual([]);
    f.commit();
    expect(await f.service.committed("receipt-1", context)).toBe("recorded");
    f.setTime(new Date("2026-01-01T00:00:02.000Z"));
    expect(await f.service.committed("receipt-1", context)).toBe("recorded");
    expect(f.rows[0]?.receivedAt).toBe("2026-01-01T00:00:01.000Z");
    expect(f.rows).toHaveLength(1);
    f.fail();
    expect(await f.service.committed("receipt-1", context)).toBe("unavailable");
  });
  it("separates permanent receipt rejection from retryable source failure", async () => {
    const f = fixture();
    f.commit();
    expect(await f.service.committed("receipt-1", { ...context, collectionAllowed: false })).toBe(
      "rejected",
    );
    for (const invalid of [{ action: "other" }, { page: "other" }, { id: "-invalid" }]) {
      const attempt = fixture();
      attempt.commit();
      attempt.setReceipt(invalid);
      expect(await attempt.service.committed("receipt-1", context)).toBe("rejected");
      expect(attempt.rows).toEqual([]);
    }
    expect(await f.service.committed("receipt-1", context)).toBe("recorded");
    f.setReceipt({ pageInstance: "conflicting-instance" });
    expect(await f.service.committed("receipt-1", context)).toBe("rejected");
    expect(f.rows).toHaveLength(1);
  });
  it("checks current permissions and collection restrictions on every read of receipt/observation", async () => {
    const f = fixture();
    expect(await f.service.observe(observation, { ...context, consent: false })).toBe("disabled");
    expect(f.rows).toEqual([]);
    f.setAuthorized(false);
    await expect(f.service.observe(observation, context)).rejects.toBeInstanceOf(
      PageExperienceCollectionProblem,
    );
    f.commit();
    expect(await f.service.committed("receipt-1", context)).toBe("rejected");
    expect(f.rows).toEqual([]);
  });
  it("rejects a browser event identity that cannot enter the normalized metric source", async () => {
    const { service, rows } = fixture();
    await expect(service.observe({ ...observation, id: "-poison" }, context)).rejects.toThrow();
    expect(rows).toEqual([]);
  });
});
