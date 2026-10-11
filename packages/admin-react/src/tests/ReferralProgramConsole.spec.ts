import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement as h } from "react";
import { ReferralProgramConsole } from "../libs/ReferralProgramConsole";

describe("Referral program console", () => {
  it("renders masked subjects and funnel counts without raw ids", () => {
    const markup = renderToStaticMarkup(
      h(ReferralProgramConsole, {
        state: {
          kind: "ready",
          grantedPermissions: ["referrals:read", "referrals:write"],
          actions: [
            {
              kind: "register-program",
              targetId: "shop:production",
              scope: { appId: "shop", environment: "production" },
              permission: "referrals:write",
              allowed: true,
              reason: "Register a new program",
              auditEvent: "referrals.admin.register-program",
              possibleProblems: ["referral-core/program-invalid"],
            },
          ],
          snapshot: {
            scope: { appId: "shop", environment: "production" },
            generatedAt: new Date("2026-02-01T00:00:00Z"),
            programs: [
              {
                id: "referral-welcome",
                version: 1,
                familyId: "referral-welcome",
                benefitCycleId: "cycle-1",
                qualifyingAction: "first-purchase",
                conversionWindowMs: 30 * 24 * 60 * 60 * 1000,
                referrerFace: "10",
                recipientFace: "5",
                startsAt: new Date("2026-01-01T00:00:00Z"),
                endsAt: new Date("2026-12-31T00:00:00Z"),
                perSubjectLimit: 1,
                budgetTotal: "1000",
                budgetReserved: "20",
                status: "active" as const,
              },
            ],
            links: [],
            attributions: [
              {
                id: "attr-1",
                linkId: "link-1",
                programId: "referral-welcome",
                programVersion: 1,
                referrer: {
                  kind: "customer",
                  id: "***",
                  maskedId: "re***r1",
                  tenantId: "tenant-a",
                  appId: "shop",
                  environment: "production",
                },
                recipient: {
                  kind: "customer",
                  id: "***",
                  maskedId: "re***99",
                  tenantId: "tenant-a",
                  appId: "shop",
                  environment: "production",
                },
                state: "indeterminate",
                cycleIndex: 1,
                claimedAt: new Date("2026-02-01T00:00:00Z"),
                updatedAt: new Date("2026-02-01T00:00:00Z"),
              },
            ],
            funnel: { clicks: 3, claims: 2, signups: 1, qualified: 1, fulfilled: 0 },
            nextShareCycle: "cycle-2",
          },
        },
      }),
    );
    expect(markup).toContain("3/2/1/1/0");
    expect(markup).toContain("next cycle cycle-2");
    expect(markup).toContain("locked until reconciliation");
  });
});
