import { createPolicyTarget, definePolicyForRuntime, defineRuntimePolicyPreset } from "../index";

const workerPreset = defineRuntimePolicyPreset({ platform: "cloudflare-workers" });
const lambdaPreset = defineRuntimePolicyPreset({ platform: "lambda" });
const target = createPolicyTarget("route", "OrdersController", { operation: "create" });

definePolicyForRuntime(
  workerPreset,
  target,
  { kind: "retry", maxAttempts: 3 },
  { requiredCapabilities: ["waitUntil"] },
);

definePolicyForRuntime(
  lambdaPreset,
  target,
  { kind: "timeout", timeoutMs: 1000 },
  { requiredCapabilities: ["flush"] },
);

definePolicyForRuntime(
  workerPreset,
  target,
  { kind: "retry", maxAttempts: 3 },
  {
    // @ts-expect-error Cloudflare Workers policies cannot require Node API support.
    requiredCapabilities: ["nodeApi"],
  },
);

definePolicyForRuntime(
  lambdaPreset,
  target,
  { kind: "timeout", timeoutMs: 1000 },
  {
    // @ts-expect-error Lambda policies cannot require shutdown support.
    requiredCapabilities: ["shutdown"],
  },
);

defineRuntimePolicyPreset({
  platform: "cloudflare-workers",
  capabilities: {
    // @ts-expect-error Cloudflare Workers cannot opt into flush capability support.
    flush: true,
  },
});
