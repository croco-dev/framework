import "reflect-metadata";
import { createServer } from "node:http";
import { Container } from "@croco/framework-context";
import { PostHogClient } from "@croco/integrations-posthog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostHogExperimentProvider } from "../libs/PostHogExperimentProvider";
import type { ExperimentDefinition } from "@croco/features-core";

const definition: ExperimentDefinition = {
  id: "checkout",
  revision: "r1",
  unit: "user",
  loginPolicy: "switch-unit",
  salt: "checkout-1",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [
    { id: "control", value: false, weight: 5000 },
    { id: "treatment", value: true, weight: 5000 },
  ],
  hypothesis: "Short checkout increases completion",
  observationPlan: "Completed orders",
  eligibility: "registered",
};
const input = {
  experimentId: "checkout",
  experimentRevision: "r1",
  scope: { app: "shop", environment: "test", tenantId: "tenant-1" },
  subject: { kind: "user", id: "stable-user" } as const,
  definition,
};

describe("PostHogExperimentProvider installed SDK HTTP boundary", () => {
  const clients: PostHogClient[] = [];
  const servers: ReturnType<typeof createServer>[] = [];
  beforeEach(() => Container.reset());
  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(clients.splice(0).map((client) => client.shutdown()));
    await Promise.all(
      servers.splice(0).map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
          }),
      ),
    );
  });

  async function fixture(response: unknown) {
    const requests: { url: string; body: unknown }[] = [];
    const server = createServer(async (request, result) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks).toString();
      requests.push({ url: request.url ?? "", body: body ? JSON.parse(body) : undefined });
      result.writeHead(200, { "content-type": "application/json" });
      result.end(JSON.stringify(response));
    });
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Fixture did not bind TCP");
    const client = new PostHogClient({
      apiKey: "fixture-key",
      host: `http://127.0.0.1:${address.port}`,
    });
    clients.push(client);
    return { provider: new PostHogExperimentProvider(client, "checkout"), client, requests };
  }

  it.each([false, true, "treatment"])(
    "preserves observed %j without claiming supported detailed metadata",
    async (value) => {
      const { provider, requests, client } = await fixture({
        featureFlags: { checkout: value },
        featureFlagPayloads: {},
      });
      expect(await provider.evaluateDetailed(input)).toEqual({
        status: "unavailable",
        reason: "detailed_metadata_unavailable",
        providerMetadata: {
          provider: "posthog",
          sdkVersion: client.getClient().getLibraryVersion(),
          flag: "checkout",
          applicationRevision: "r1",
          observedValue: JSON.stringify(value),
        },
      });
      await client.flush();
      expect(requests).toHaveLength(1);
      expect(requests[0]?.body).toMatchObject({ groups: { tenant: "tenant-1" } });
    },
  );

  it("marks an absent flag unavailable rather than control", async () => {
    const { provider } = await fixture({ featureFlags: {}, featureFlagPayloads: {} });
    expect(await provider.evaluateDetailed(input)).toMatchObject({
      status: "unavailable",
      reason: "provider_value_unavailable",
    });
  });

  it("reports the same unsupported capability in preview without emitting exposure events", async () => {
    const { provider, requests, client } = await fixture({ featureFlags: { checkout: false } });
    expect(await provider.previewDetailed(input)).toMatchObject({
      status: "unavailable",
      reason: "detailed_metadata_unavailable",
      providerMetadata: { observedValue: "false" },
    });
    await client.flush();
    expect(requests).toHaveLength(1);
  });

  it("does not admit SDK partial compute-error values", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { provider } = await fixture({
      featureFlags: { checkout: false },
      errorsWhileComputingFlags: true,
    });
    expect(await provider.evaluateDetailed(input)).toMatchObject({ status: "unavailable" });
    expect(consoleError).toHaveBeenCalled();
  });

  it("keeps request failure distinct and does not return control", async () => {
    const { provider, client } = await fixture({ featureFlags: {} });
    vi.spyOn(client.getClient(), "getFeatureFlag").mockRejectedValue(new Error("fixture failure"));
    expect(await provider.evaluateDetailed(input)).toMatchObject({
      status: "evaluation_failed",
      reason: "provider_request_failed",
    });
  });

  it("requires a stable identity before any SDK request", async () => {
    const { provider, requests } = await fixture({ featureFlags: {} });
    expect(
      await provider.evaluateDetailed({ ...input, subject: { kind: "user", id: "" } }),
    ).toEqual({ status: "not_assigned", reason: "stable_identity_required" });
    expect(requests).toEqual([]);
  });
});
