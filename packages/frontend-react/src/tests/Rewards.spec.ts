import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BadgeShelf, RewardReceipt } from "../libs/Rewards";
import type { RewardGrant } from "@croco/gamification-core";

describe("reward views", () => {
  it("keeps large point totals exact and shows owned badges", () => {
    const entry = {
      grantId: "g",
      unit: "achievement-point" as const,
      amount: Number.MAX_SAFE_INTEGER,
      createdAt: "2026-01-01",
    };
    const html = renderToStaticMarkup(
      h(BadgeShelf, {
        state: {
          kind: "ready",
          value: {
            points: [entry, entry],
            grants: [],
            badges: [
              { badgeId: "first", grantId: "g", title: "First report", createdAt: "2026-01-01" },
            ],
          },
        },
      }),
    );
    expect(html).toContain("18014398509481982 achievement points");
    expect(html).toContain("First report");
  });
  it("renders explicit unavailable and partial states", () => {
    expect(renderToStaticMarkup(h(BadgeShelf, { state: { kind: "loading" } }))).toContain(
      'aria-busy="true"',
    );
    expect(
      renderToStaticMarkup(h(BadgeShelf, { state: { kind: "denied", message: "Access denied" } })),
    ).toContain('role="alert"');
    expect(
      renderToStaticMarkup(
        h(BadgeShelf, {
          state: { kind: "partial", value: { points: [], badges: [], grants: [] } },
        }),
      ),
    ).toContain("unavailable");
  });
  it("never offers a redraw for an indeterminate persisted selection", () => {
    const grant: RewardGrant = {
      id: "receipt-1",
      scope: { appId: "a", tenantId: "t", environmentId: "test" },
      subject: "member",
      policyId: "p",
      policyVersion: "v1",
      evidenceRef: "e",
      state: "indeterminate",
      rejection: null,
      createdAt: "2026-01-01",
      selection: {
        entry: null,
        receipt: {
          policyVersion: "v1",
          revision: 1,
          mode: "weighted",
          weights: [1, 3],
          bucket: 1,
          fallback: true,
          fallbackPolicy: { kind: "no-reward" },
        },
      },
    };
    const html = renderToStaticMarkup(h(RewardReceipt, { state: { kind: "ready", value: grant } }));
    expect(html).toContain("Outcome unresolved");
    expect(html).toContain("receipt-1");
    expect(html).toContain("1 : 3");
    expect(html).not.toContain("<button");
  });
});
