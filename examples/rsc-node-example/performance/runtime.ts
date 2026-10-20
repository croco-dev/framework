import { readFile } from "node:fs/promises";
import { join } from "node:path";
// Synthetic, process-local lab composition; never an authentication or durable storage example.
import {
  InMemoryCacheStore,
  definePersonalizedCachePolicy,
} from "../../../packages/cache-core/src/index";
import { PersonalizedFragmentProblem } from "../../../packages/meta-vite/src/libs/isr/personalizedFragmentProblems";
import { loadPersonalizedFragments } from "../../../packages/meta-vite/src/libs/isr/personalizedFragments";
import { ExperimentRuntime } from "../../../packages/features-core/src/libs/ExperimentRuntime";
import { InMemoryExperimentStore } from "../../../packages/features-core/src/libs/InMemoryExperimentStore";
import {
  ExperimentDeliveryBridge,
  InMemoryExperimentDeliveryStore,
} from "../../../packages/features-core/src/libs/ExperimentDelivery";
import { CloudflareImagesProvider } from "../../../packages/storage-cloudflare/src/libs/CloudflareImagesProvider";
import type { PersonalizedFragmentStore } from "../../../packages/meta-vite/src/libs/isr/personalizedFragments";

const cache = new InMemoryCacheStore<unknown>({ maxEntries: 100 });
const store: PersonalizedFragmentStore = {
  async getOrSet<V>(key: string, factory: () => Promise<V>, options?: { ttlMs?: number }) {
    return (await cache.getOrSet(key, factory, options)) as V;
  },
  async invalidate(key) {
    await cache.delete(key);
  },
};
const scope = { app: "pdp-lab", environment: "synthetic", tenantId: "fixture" };
const target = { scope, experimentId: "print-copy", experimentRevision: "1" };
const experiment = new ExperimentRuntime({
  store: new InMemoryExperimentStore(),
  authorization: { authorize: (request) => request.actor === "lab-server" },
});
const initialized = (async () => {
  await experiment.register(
    {
      definition: {
        id: target.experimentId,
        revision: "1",
        unit: "user",
        loginPolicy: "preserve-unit",
        salt: "synthetic-lab-v1",
        allocatorVersion: "sha256-v1",
        allocation: 10000,
        variants: [
          { id: "control", value: "Explore the print", weight: 5000 },
          { id: "detail", value: "Explore the orbital details", weight: 5000 },
        ],
        hypothesis: "Clearer supporting copy",
        observationPlan: "Synthetic display only; no conversion claim",
        eligibility: "lab",
      },
      eligibility: () => ({ status: "eligible" }),
      handlers: { control: () => undefined, detail: () => undefined },
    },
    scope,
    "lab-server",
  );
  await experiment.start({
    ...target,
    actor: "lab-server",
    expectedRevision: 0,
    reason: "synthetic fixture",
    idempotencyKey: "start",
  });
})();
const bridge = new ExperimentDeliveryBridge({
  regions: [{ id: "supporting-copy", target, policyRevision: "1" }],
  reader: experiment,
  store: new InMemoryExperimentDeliveryStore(),
  ttlMs: 60000,
  evaluationTimeoutMs: 1000,
});
// URL policy reuses the real adapter. The local server serves versioned static SVG fixtures
// at its generated paths: no Cloudflare request, transformation or CDN certification is claimed.
const images = new CloudflareImagesProvider({
  accountId: "lab",
  accountHash: "lab",
  apiToken: "unused-synthetic",
  customDomain: "fixture.invalid",
});
export function imagePath(width: number) {
  return new URL(
    images.getTransformUrl("orbit", { width, height: Math.round(width * 0.75), fit: "cover" }),
  ).pathname;
}
export async function resetLabCache() {
  await cache.clear();
}
export async function loadPdp(request: Request) {
  await initialized;
  const url = new URL(request.url);
  const configuration = url.searchParams.get("configuration") ?? "baseline";
  const personalized = configuration === "personalization" || configuration === "combined";
  const experimented = configuration === "experiment" || configuration === "combined";
  const user = request.headers.get("cookie")?.includes("lab-user=bob") ? "bob" : "alice";
  const started = performance.now();
  if (url.searchParams.get("fault") === "blocking") {
    const upstream = await fetch(new URL("/lab/blocking-fetch", request.url));
    await upstream.text();
  }
  const publicReads: { name: string; startMs: number; endMs: number }[] = [];
  async function readPublic(name: string) {
    const startMs = performance.now() - started;
    // An actual independent asynchronous read boundary, not a simulated cache or allocator.
    const result = await readFile(
      join(process.cwd(), "performance/catalog", `${name}.txt`),
      "utf8",
    );
    publicReads.push({ name, startMs, endMs: performance.now() - started });
    return result;
  }
  const [title, description] = await Promise.all([readPublic("title"), readPublic("description")]);
  const decision = experimented
    ? (
        await bridge.prepare(
          ["supporting-copy"],
          { scope, actor: "lab-server", subject: { kind: "user", id: user } },
          "admitted",
        )
      )[0]
    : undefined;
  const inspect: { zone: string; outcome: string; reason: string }[] = [];
  const deferred = (async () => {
    if (!personalized) return { text: "Discover more prints", source: "disabled" };
    try {
      const fragments = await loadPersonalizedFragments({
        store,
        representation: "flight",
        policy: definePersonalizedCachePolicy({
          scope: {
            app: "pdp-lab",
            env: "synthetic",
            tenant: "fixture",
            site: "lab",
            locale: "en",
            resource: "orbit",
          },
          revision: "1",
          zones: [
            { zone: "public", dependencies: [{ name: "print", revision: "1" }] },
            { zone: "private" },
          ],
        }),
        publicLoader: {
          zone: "public",
          load: async () => ({
            value: "More orbital studies",
            bytes: JSON.stringify("More orbital studies"),
          }),
        },
        privateLoader: {
          zone: "private",
          load: async () => {
            if (url.searchParams.get("fault") === "personalization")
              throw new PersonalizedFragmentProblem("Synthetic optional failure", {
                reason: "injected-unavailable",
              });
            if (url.searchParams.get("fault") === "deferred-blocking") {
              const slow = await fetch(new URL("/lab/blocking-fetch", request.url));
              await slow.text();
            }
            const source = await fetch(new URL("/lab/recommendation", request.url));
            if (!source.ok)
              throw new PersonalizedFragmentProblem("Synthetic source unavailable", {
                reason: "source-unavailable",
              });
            return `${await source.text()} for ${user}`;
          },
        },
        inspect: ({ zone, outcome, reason }) => inspect.push({ zone, outcome, reason }),
      });
      return {
        text: `${fragments.public}: ${fragments.privateValue}`,
        source: fragments.cache.publicSource,
      };
    } catch {
      inspect.push({ zone: "private", outcome: "bypass", reason: "optional-unavailable" });
      return { text: "Recommendations unavailable", source: "unavailable" };
    }
  })();
  return {
    title,
    description,
    user,
    decision,
    deferred,
    inspect,
    publicReads,
    serverMs: performance.now() - started,
  };
}

export async function exposeLab(
  request: Request,
  input: { receipt: string; displayInstanceId: string; occurredAt: string },
): Promise<void> {
  const user = request.headers.get("cookie")?.includes("lab-user=bob") ? "bob" : "alice";
  await bridge.expose(
    input.receipt,
    { scope, actor: "lab-server", subject: { kind: "user", id: user } },
    input.displayInstanceId,
    input.occurredAt,
  );
}
