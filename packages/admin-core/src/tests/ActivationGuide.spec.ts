import { describe, expect, it } from "vitest";
import {
  ActivationGuideValidationProblem,
  assertActivationGuidePreviewRequest,
  assertActivationGuidePublishRequest,
} from "../libs/ActivationGuide";
import type { ActivationGuideAccess, ActivationGuidePublishRequest } from "../libs/ActivationGuide";

const scope = { tenantId: "tenant", appId: "app", environmentId: "test" };
const access: ActivationGuideAccess = {
  scope,
  actor: "operator",
  permissions: ["onboarding.goal.read", "onboarding.goal.preview", "onboarding.goal.publish"],
};
const publication: ActivationGuidePublishRequest = {
  scope,
  definition: {
    id: "first-report",
    version: "v1",
    anchor: "signup",
    actionId: "report.saved",
    windowMs: 7 * 86_400_000,
    allowedLatenessMs: 86_400_000,
    timezone: "Asia/Seoul",
    countMode: "events",
    threshold: 1,
    deletedObjectPolicy: "retain",
    title: "Save a report",
    nextActionHref: "/reports/new",
  },
  actor: "operator",
  reason: "Initial guide",
  expectedRevision: 0,
  idempotencyKey: "publish-v1",
};

describe("Activation guide admin boundary", () => {
  it("accepts an authorized and audited definition publication", () => {
    expect(() => assertActivationGuidePublishRequest(publication, access)).not.toThrow();
  });

  it("rejects absent or cross-tenant scope and missing permission", () => {
    for (const tenantId of ["", "other"]) {
      expect(() =>
        assertActivationGuidePublishRequest(
          { ...publication, scope: { ...scope, tenantId } },
          access,
        ),
      ).toThrow(ActivationGuideValidationProblem);
    }
    expect(() =>
      assertActivationGuidePublishRequest(publication, { ...access, permissions: [] }),
    ).toThrow(ActivationGuideValidationProblem);
  });

  it("requires actor identity, reason, expected revision, and idempotency", () => {
    expect(() =>
      assertActivationGuidePublishRequest({ ...publication, actor: "other" }, access),
    ).toThrow();
    expect(() =>
      assertActivationGuidePublishRequest({ ...publication, reason: "" }, access),
    ).toThrow();
    expect(() =>
      assertActivationGuidePublishRequest({ ...publication, expectedRevision: -1 }, access),
    ).toThrow();
    expect(() =>
      assertActivationGuidePublishRequest({ ...publication, idempotencyKey: "" }, access),
    ).toThrow();
  });

  it("uses the shared definition validator", () => {
    expect(() =>
      assertActivationGuidePublishRequest(
        {
          ...publication,
          definition: { ...publication.definition, nextActionHref: "javascript:alert(1)" },
        },
        access,
      ),
    ).toThrow();
  });

  it("previews only a verified subject in the authorized scope", () => {
    const request = {
      scope,
      subject: { id: "user", verified: true as const },
      episodeId: "signup-1",
      asOf: "2026-09-28T00:00:00Z",
    };
    expect(() => assertActivationGuidePreviewRequest(request, access)).not.toThrow();
    expect(() =>
      assertActivationGuidePreviewRequest({ ...request, episodeId: "" }, access),
    ).toThrow();
    expect(() =>
      assertActivationGuidePreviewRequest({ ...request, asOf: "invalid" }, access),
    ).toThrow();
    expect(() =>
      assertActivationGuidePreviewRequest(request, {
        ...access,
        permissions: ["onboarding.goal.read"],
      }),
    ).toThrow();
  });
});
