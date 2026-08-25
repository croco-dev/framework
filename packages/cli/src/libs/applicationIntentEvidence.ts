import type {
  ApplicationIntentGoal,
  ApplicationIntentProvider,
  ApplicationIntentQualityGate,
  ApplicationIntentRuntimeTarget,
} from "@croco/framework-context";

export type ApplicationIntentQualityGateEvidence =
  | { readonly kind: "package-manager" }
  | { readonly kind: "root-script"; readonly script: string }
  | {
      readonly kind: "workspace-script";
      readonly packageNameSuffix: string;
      readonly script: string;
    };

const APPLICATION_INTENT_RUNTIME_PACKAGES = {
  node: "@croco/transports-http",
  "cloudflare-workers": "@croco/transports-cloudflare-workers",
} as const satisfies Record<ApplicationIntentRuntimeTarget, string>;

const APPLICATION_INTENT_PROVIDER_PACKAGES = {
  "in-memory-tenant": "@croco/tenant-core",
  "in-memory-auth": "@croco/auth-core",
  "in-memory-billing": "@croco/billing-core",
  "in-memory-metering": "@croco/metering-core",
  "in-memory-events": null,
  "in-memory-repository": "@croco/repository-core",
  "generated-rpc-client": null,
  "cloudflare-workers": "@croco/transports-cloudflare-workers",
  "meta-vite": "@croco/meta-vite",
  "in-memory-admin-data": "@croco/admin-core",
} as const satisfies Record<ApplicationIntentProvider, string | null>;

const APPLICATION_INTENT_GOAL_PROVIDER_PACKAGES: Readonly<
  Partial<Record<`${ApplicationIntentGoal}:${ApplicationIntentProvider}`, string>>
> = {
  "saas-api:in-memory-events": "@croco/events-core",
  "spa-backend-split:in-memory-events": "@croco/events-inmemory",
};

const APPLICATION_INTENT_QUALITY_GATE_EVIDENCE = {
  install: { kind: "package-manager" },
  typecheck: { kind: "root-script", script: "typecheck" },
  build: { kind: "root-script", script: "build" },
  test: { kind: "root-script", script: "test" },
  "contract:verify": { kind: "root-script", script: "contract:verify" },
  "demo:smoke": { kind: "root-script", script: "demo:smoke" },
  "failure-drill:smoke": { kind: "root-script", script: "failure-drill:smoke" },
  "dev:smoke": { kind: "root-script", script: "dev:smoke" },
  lint: { kind: "root-script", script: "lint" },
  "ssr-worker:presentation:smoke": {
    kind: "workspace-script",
    packageNameSuffix: "/ssr-worker",
    script: "presentation:smoke",
  },
  "admin:smoke": { kind: "root-script", script: "admin:smoke" },
} as const satisfies Record<ApplicationIntentQualityGate, ApplicationIntentQualityGateEvidence>;

export function getApplicationIntentRuntimePackage(
  runtimeTarget: ApplicationIntentRuntimeTarget,
): string {
  return APPLICATION_INTENT_RUNTIME_PACKAGES[runtimeTarget];
}

export function getApplicationIntentProviderPackage(
  provider: ApplicationIntentProvider,
  scope: string,
  goal: ApplicationIntentGoal,
): string {
  return (
    APPLICATION_INTENT_GOAL_PROVIDER_PACKAGES[`${goal}:${provider}`] ??
    APPLICATION_INTENT_PROVIDER_PACKAGES[provider] ??
    `${scope}/provider-rpc`
  );
}

export function getApplicationIntentQualityGateEvidence(
  qualityGate: ApplicationIntentQualityGate,
): ApplicationIntentQualityGateEvidence {
  return APPLICATION_INTENT_QUALITY_GATE_EVIDENCE[qualityGate];
}
