import {
  InMemoryPolicyReleaseStore,
  PolicyAuthorizationProblem,
  PolicyReleaseService,
  PolicyUnavailableProblem,
} from "@croco/features-core";
import type { ParameterizedPolicy, PolicyContext, PolicyScope } from "@croco/features-core";

type BannerValue = {
  title: string;
  maxViews: number;
};
type BannerContext = PolicyContext & { readonly priorViews: number };
type BannerDecision = { readonly show: boolean; readonly title: string };

const scope: PolicyScope = {
  app: "banner-example",
  environment: "demo",
  tenantId: "demo-tenant",
};

const banner: ParameterizedPolicy<BannerValue, BannerContext, BannerDecision> = {
  id: "welcome-banner",
  schemaVersion: "1",
  codeRegistrationId: "welcome-banner-v1",
  schema: {
    version: "1",
    validate(value) {
      if (
        typeof value !== "object" ||
        value === null ||
        !("title" in value) ||
        typeof value.title !== "string" ||
        value.title.length === 0 ||
        !("maxViews" in value) ||
        typeof value.maxViews !== "number" ||
        !Number.isInteger(value.maxViews) ||
        value.maxViews < 1 ||
        value.maxViews > 5
      ) {
        return [
          {
            code: "banner/invalid-value",
            severity: "error",
            path: "value",
            message: "Title and view limit are required",
          },
        ];
      }
      return [];
    },
  },
  fieldDescriptors: [
    {
      id: "title",
      label: "Banner title",
      input: "text",
      read: (value) => value.title,
      write: (value, next) => ({ ...value, title: String(next) }),
    },
    {
      id: "maxViews",
      label: "Maximum views",
      input: "number",
      min: 1,
      max: 5,
      read: (value) => value.maxViews,
      write: (value, next) => ({ ...value, maxViews: Number(next) }),
    },
  ],
  evaluate: (value, context) => ({
    show: context.priorViews < value.maxViews,
    title: value.title,
  }),
};

async function main(): Promise<void> {
  const service = new PolicyReleaseService({
    store: new InMemoryPolicyReleaseStore(),
    clock: { now: () => new Date("2026-09-29T12:00:00.000Z") },
    authorization: {
      authorize(request) {
        if (
          request.scope.app !== scope.app ||
          request.scope.environment !== scope.environment ||
          request.scope.tenantId !== scope.tenantId ||
          (request.actor && request.actor.id !== "demo-operator")
        ) {
          throw new PolicyAuthorizationProblem(request.policyId, request.action);
        }
      },
    },
  });
  service.registerPolicy(banner);
  const target = { policyId: banner.id, scope };
  const actor = { id: "demo-operator" };
  const draft = await service.createDraft({
    ...target,
    value: { title: "Welcome", maxViews: 3 },
    actor,
    reason: "Create banner",
  });
  const reviewed = await service.review({
    ...target,
    expectedRevision: draft.revision,
    actor,
    reason: "Review banner",
  });
  await service.publish({
    ...target,
    expectedRevision: reviewed.revision,
    reviewHash: reviewed.review?.reviewedHash ?? "",
    actor,
    reason: "Release banner",
    idempotencyKey: "demo-publish-1",
  });
  const resolution = await service.resolve<BannerValue>(target);
  const decision = await service.evaluate<BannerContext, BannerDecision>({
    ...target,
    context: { priorViews: 2 },
  });
  if (
    resolution.status !== "active" ||
    decision.status !== "active" ||
    decision.value?.show !== true
  ) {
    throw new PolicyUnavailableProblem(banner.id, "The published banner was not active");
  }
  console.log(JSON.stringify({ resolution, decision }, null, 2));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
