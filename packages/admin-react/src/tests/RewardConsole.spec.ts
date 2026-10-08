import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RewardConsole } from "../libs/RewardConsole";
import type { PublishedRewardPolicy } from "@croco/gamification-core";

describe("RewardConsole", () => {
  it("defaults to a fixed published policy and requires an audit reason", () => {
    const publication: PublishedRewardPolicy = {
      scope: { appId: "app", tenantId: "tenant", environmentId: "test" },
      actorId: "operator",
      reason: "Initial",
      expectedRevision: 0,
      revision: 1,
      idempotencyKey: "first",
      policy: {
        id: "p",
        version: "v1",
        title: "Policy",
        mode: "fixed",
        rewardEntries: [
          { id: "points", kind: "points", title: "Points", amount: 1, unit: "achievement-point" },
        ],
        budgetUnit: "achievement-grant",
        cap: 10,
        fallback: { kind: "no-reward" },
        effectiveFrom: "2026-01-01T00:00:00Z",
        effectiveUntil: "2099-01-01T00:00:00Z",
      },
    };
    const html = renderToStaticMarkup(
      h(RewardConsole, {
        publication,
        access: { scope: publication.scope, actorId: "operator", permissions: ["reward.publish"] },
        onPublish: async () => publication,
      }),
    );
    expect(html).toContain("Fixed reward");
    expect(html).toContain("Publication reason");
    expect(html).toContain("When depleted: no reward");
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('checked=""');
  });
});
