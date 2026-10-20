import { describe, expect, it } from "vitest";
import { createPageExperienceCollector } from "../libs/pageExperienceCollector";
import type { PageExperienceObservation } from "../libs/pageExperienceCollector";
describe("Page experience collector", () => {
  it("emits no prefetch view, deduplicates remount and counts only visible time after content", async () => {
    let time = 0,
      visible = true,
      consent = true;
    const sent: PageExperienceObservation[] = [];
    const c = createPageExperienceCollector({
      page: "product",
      pageInstance: "nav1",
      contentCondition: "hero",
      contentMinIntersectionRatio: 0.5,
      engagementActions: ["preview"],
      valueAction: "purchase",
      enabled: () => consent,
      clock: () => time,
      monotonic: () => time,
      visible: () => visible,
      send: async (rows) => {
        sent.push(...rows);
      },
      maxBuffer: 20,
      maxAttempts: 2,
    });
    expect(c.status().queued).toBe(0);
    c.start();
    c.start();
    time = 500;
    c.contentDisplayed(1);
    time = 1500;
    visible = false;
    c.pause();
    time = 5000;
    visible = true;
    c.resume();
    time = 5500;
    c.observe();
    await c.flush();
    expect(sent.filter((r) => r.kind === "view")).toHaveLength(1);
    expect(sent.find((r) => r.kind === "visible")?.value).toBe("1500");
    consent = false;
    c.action("preview", "click1");
    await c.flush();
    expect(sent).toHaveLength(3);
  });
  it("bounds the buffer and retries the same event identities, then explicitly drops", async () => {
    let calls = 0;
    const ids: string[][] = [];
    const c = createPageExperienceCollector({
      page: "product",
      pageInstance: "nav1",
      contentCondition: "hero",
      contentMinIntersectionRatio: 0.5,
      engagementActions: ["preview"],
      valueAction: "purchase",
      enabled: () => true,
      clock: () => 0,
      monotonic: () => 0,
      visible: () => true,
      send: async (rows) => {
        ids.push(rows.map((r) => r.id));
        calls++;
        throw new Error("offline");
      },
      maxBuffer: 2,
      maxAttempts: 2,
    });
    c.start();
    c.contentDisplayed(1);
    c.action("preview", "click1");
    expect(c.status().dropped).toBe(1);
    await c.flush();
    expect(c.status().queued).toBe(2);
    await c.flush();
    expect(c.status().queued).toBe(0);
    expect(c.status().dropped).toBe(3);
    expect(ids[0]).toEqual(ids[1]);
    expect(calls).toBe(2);
  });
  it("revokes buffered data and allocates a distinct view for an actual navigation", async () => {
    const sent: PageExperienceObservation[] = [];
    const make = (pageInstance: string) =>
      createPageExperienceCollector({
        page: "product",
        pageInstance,
        contentCondition: "hero",
        contentMinIntersectionRatio: 0.5,
        engagementActions: ["preview"],
        valueAction: "purchase",
        enabled: () => true,
        clock: () => 0,
        monotonic: () => 0,
        visible: () => true,
        send: async (rows) => {
          sent.push(...rows);
        },
        maxBuffer: 2,
        maxAttempts: 1,
      });
    const first = make("nav1");
    first.start();
    first.revoke();
    await first.flush();
    expect(sent).toEqual([]);
    const next = make("nav2");
    next.start();
    await next.flush();
    expect(sent[0]?.pageInstance).toBe("nav2");
  });
  it("separates an engagement and attempt sharing one interaction reference and rejects raw URL configuration", async () => {
    const sent: PageExperienceObservation[] = [];
    const policy = {
      page: "product",
      pageInstance: "nav1",
      contentCondition: "hero",
      contentMinIntersectionRatio: 0.5,
      engagementActions: ["preview"],
      valueAction: "purchase",
      enabled: () => true,
      clock: () => 0,
      monotonic: () => 0,
      visible: () => true,
      send: async (rows: readonly PageExperienceObservation[]) => {
        sent.push(...rows);
      },
      maxBuffer: 20,
      maxAttempts: 2,
    };
    const collector = createPageExperienceCollector(policy);
    collector.start();
    collector.action("preview", "interaction1");
    collector.attempt("purchase", "interaction1");
    await collector.flush();
    expect(sent.map((row) => row.kind)).toEqual(["view", "action", "attempt"]);
    expect(() =>
      createPageExperienceCollector({ ...policy, page: "https://shop.test/?email=private" }),
    ).toThrow();
  });
});
