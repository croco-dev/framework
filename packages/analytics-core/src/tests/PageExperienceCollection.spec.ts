import { describe, expect, it } from "vitest";
import {
  PageExperienceCollection,
  PageExperienceCollectionProblem,
} from "../libs/PageExperienceCollection";
import type { PageExperienceCollectionContext } from "../libs/PageExperienceCollection";
import type { PageExperienceRow } from "@croco/metrics-core";
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
  let authorized = true,
    committed = false,
    fail = false;
  const service = new PageExperienceCollection({
    definition: {
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
    },
    allowedOrigins: ["https://shop.test"],
    clock: () => new Date("2026-01-01T00:00:01.000Z"),
    authorize: async () => authorized,
    append: async (row) => {
      if (fail) throw new Error("source failed");
      if (!rows.some((r) => r.id === row.id && r.source === row.source)) rows.push(row);
    },
    verifyReceipt: async (ref) =>
      committed && ref === "receipt-1"
        ? {
            id: ref,
            source: "billing",
            occurredAt: "2026-01-01T00:00:00.000Z",
            action: "purchase",
            pageInstance: "p1",
            page: "product",
          }
        : null,
  });
  return {
    service,
    rows,
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
    expect(await f.service.committed("receipt-1", context)).toBe("unavailable");
    expect(f.rows).toEqual([]);
    f.commit();
    expect(await f.service.committed("receipt-1", context)).toBe("recorded");
    expect(await f.service.committed("receipt-1", context)).toBe("recorded");
    expect(f.rows).toHaveLength(1);
    f.fail();
    expect(await f.service.committed("receipt-1", context)).toBe("unavailable");
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
    expect(await f.service.committed("receipt-1", context)).toBe("unavailable");
    expect(f.rows).toEqual([]);
  });
  it("rejects a browser event identity that cannot enter the normalized metric source", async () => {
    const { service, rows } = fixture();
    await expect(service.observe({ ...observation, id: "-poison" }, context)).rejects.toThrow();
    expect(rows).toEqual([]);
  });
});
