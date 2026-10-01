import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { OfferConsole } from "../libs/OfferConsole";
import type { OfferConsoleSnapshot } from "@croco/admin-core";

const snapshot: OfferConsoleSnapshot = {
  scope: { appId: "shop", environment: "production" },
  generatedAt: new Date("2026-09-29T00:00:00Z"),
  policies: [
    {
      id: "welcome-trial",
      version: 1,
      familyId: "welcome-trial",
      benefitCycleId: "2026-q4",
      benefitKind: "trial-credits",
      face: "30",
      currency: undefined,
      startsAt: new Date("2026-09-01T00:00:00Z"),
      endsAt: new Date("2026-12-31T00:00:00Z"),
      perSubjectLimit: 1,
      budgetTotal: "100",
      budgetReserved: "30",
      stackingGroup: undefined,
      allowStacking: false,
      status: "active",
    },
  ],
  claims: [
    {
      id: "claim-1",
      logicalKey: "logical-1",
      policyId: "welcome-trial",
      policyVersion: 1,
      subject: {
        kind: "customer",
        id: "cu***45",
        maskedId: "cu***45",
        tenantId: "tenant-a",
        appId: "shop",
        environment: "production",
      },
      benefitKind: "trial-credits",
      faceAmount: "30",
      costAmount: "30",
      currency: undefined,
      state: "indeterminate",
      grantRef: undefined,
      createdAt: new Date("2026-09-29T00:00:00Z"),
      updatedAt: new Date("2026-09-29T00:00:00Z"),
    },
  ],
  pendingBudget: "30",
};

describe("OfferConsole", () => {
  it("renders policies, masked claims, and audited actions", () => {
    const markup = renderToStaticMarkup(
      h(OfferConsole, {
        state: {
          kind: "ready",
          snapshot,
          grantedPermissions: ["promotions:read", "promotions:write", "promotions:resolve"],
          actions: [
            {
              kind: "resolve-claim",
              targetId: "claim-1",
              scope: snapshot.scope,
              permission: "promotions:resolve",
              allowed: true,
              reason: "Resolve an unclear grant",
              auditEvent: "promotions.admin.resolve-claim",
              possibleProblems: ["promotions-core/claim-state-conflict"],
            },
          ],
        },
      }),
    );
    expect(markup).toContain("welcome-trial v1");
    expect(markup).toContain("budget 30/100");
    expect(markup).toContain("cu***45");
    expect(markup).not.toContain("customer-12345");
    expect(markup).toContain("budget stays locked");
    expect(markup).toContain("Resolve claim");
    expect(markup).toContain("Policy editor");
  });

  it("keeps editor errors next to their fields", () => {
    const markup = renderToStaticMarkup(
      h(OfferConsole, {
        state: {
          kind: "ready",
          snapshot: { ...snapshot, claims: [] },
          grantedPermissions: ["promotions:read"],
          actions: [],
        },
        editorErrors: { versionText: "use an integer version of at least 1" },
        onSubmitPolicy: () => undefined,
      }),
    );
    expect(markup).toContain("use an integer version of at least 1");
    expect(markup).toContain("Validate policy");
  });
});
