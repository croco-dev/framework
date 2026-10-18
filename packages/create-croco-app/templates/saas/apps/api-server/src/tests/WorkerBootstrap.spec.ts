import { beforeEach, describe, expect, it } from "vitest";
import { Container, Context } from "@croco/framework-context";
import { CLOUDFLARE_ENV_TOKEN } from "@croco/preset-cloudflare/application";
import { createWorkerApplication, assertWorkerProfileGraph } from "../workerBootstrap";

const execution = { waitUntil() {}, passThroughOnException() {}, props: undefined };

describe("native Worker bootstrap boundary", () => {
  beforeEach(() => Container.reset());
  it("keeps concurrent applications and request scopes separate without selecting fake SaaS providers", async () => {
    const envA = { PRIVATE_SENTINEL: "private-env-A" };
    const envB = { PRIVATE_SENTINEL: "private-env-B" };
    const [a, b] = await Promise.all([
      createWorkerApplication(envA),
      createWorkerApplication(envB),
    ]);
    try {
      expect(a.runtime.get(CLOUDFLARE_ENV_TOKEN)).toBe(envA);
      expect(b.runtime.get(CLOUDFLARE_ENV_TOKEN)).toBe(envB);
      const responses = await Promise.all([
        a.fetch(
          new Request("https://worker.test/ops/health", {
            headers: { "x-request-id": "request-A" },
          }),
          envA,
          execution,
        ),
        b.fetch(
          new Request("https://worker.test/ops/health", {
            headers: { "x-request-id": "request-B" },
          }),
          envB,
          execution,
        ),
      ]);
      const bodies = await Promise.all(responses.map((response) => response.json()));
      expect(bodies.map(({ requestId }) => requestId)).toEqual(["request-A", "request-B"]);
      for (const body of bodies) {
        expect(body).toMatchObject({ status: "healthy", scope: "bootstrap-only", fullSaas: false });
        expect(
          body.capabilities.filter(({ state }: { state: string }) => state === "unavailable"),
        ).toHaveLength(8);
        expect(JSON.stringify(body)).not.toContain("private-env");
      }
      expect(Context.get()).toBeNull();
      await expect(
        a.fetch(new Request("https://worker.test/ops/health"), envB, execution),
      ).rejects.toMatchObject({ code: "CROCO_SAAS_PROFILE_GRAPH_DRIFT" });
      const failure = await a.fetch(
        new Request("https://worker.test/webhooks/polar", {
          method: "POST",
          body: "private-payload",
        }),
        envA,
        execution,
      );
      expect(failure.status).toBe(501);
      expect(await failure.json()).toMatchObject({
        code: "CROCO_SAAS_PROFILE_CAPABILITY_UNAVAILABLE",
        status: 501,
      });
      expect(a.runtime.createGraphManifest().providerReplacements).toEqual([]);
    } finally {
      await Promise.all([a.runtime.dispose(), b.runtime.dispose()]);
    }
  });

  it("rejects an invalid profile binding and a drifted runtime graph", async () => {
    await expect(
      createWorkerApplication({ SAAS_PROVIDER_PROFILE: "private-wrong-profile" }),
    ).rejects.toMatchObject({ code: "CROCO_SAAS_PROFILE_BINDING_INVALID" });
    const app = await createWorkerApplication({});
    try {
      const graph = app.runtime.createGraphManifest();
      const host = graph.plugins.at(0);
      if (!host) throw new Error("Missing host plugin");
      expect(() =>
        assertWorkerProfileGraph({
          ...graph,
          plugins: [
            {
              ...host,
              capabilities: [...host.capabilities, { id: "billing.fake", kind: "single" }],
            },
          ],
        }),
      ).toThrow("Worker runtime graph differs");
      expect(() => assertWorkerProfileGraph({ ...graph, plugins: [] })).toThrow(
        "Worker runtime graph differs",
      );
      expect(() =>
        assertWorkerProfileGraph({
          ...graph,
          providerReplacements: [{ token: "fake", replaces: ["@croco/preset-cloudflare/host"] }],
        }),
      ).toThrow("Worker runtime graph differs");
    } finally {
      await app.runtime.dispose();
    }
  });
});
