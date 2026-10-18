import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { ModuleKind, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";
import {
  createSaasProviderProfileManifest,
  SAAS_PROVIDER_PROFILES,
} from "../saas-provider-profiles.js";

describe("Cloudflare SaaS bootstrap capability boundary", () => {
  it("selects an executable native host without advertising absent SaaS providers", () => {
    const manifest = createSaasProviderProfileManifest(SAAS_PROVIDER_PROFILES["saas-cloudflare"]);
    expect(manifest.composition).toMatchObject({
      executable: true,
      scope: "bootstrap-only",
      plugins: [
        {
          factoryExport: "cloudflareWorkersHost",
          pluginName: "cloudflare-workers-host",
          packageName: "@croco/preset-cloudflare",
          moduleNames: ["@croco/preset-cloudflare/host"],
          capabilities: ["runtime.host"],
        },
      ],
    });
    expect(manifest.capabilities.find(({ capability }) => capability === "runtime")).toMatchObject({
      productionState: "configured-production-plugin",
      zeroCredentialState: "configured-production-plugin",
    });
    expect(
      manifest.capabilities
        .filter(({ capability }) => capability !== "runtime")
        .map(({ capability, productionState }) => [capability, productionState]),
    ).toEqual([
      ["auth", "unavailable"],
      ["persistence", "unavailable"],
      ["billing", "unavailable"],
      ["metering", "unavailable"],
      ["storage", "unavailable"],
      ["tasks", "unavailable"],
      ["telemetry", "unavailable"],
      ["webhookVerification", "unavailable"],
    ]);
  });
});

// The entry cache is tested separately from native runtime/provider integration.
describe("Worker entry environment cache", () => {
  it("coalesces one environment while isolating another and redacting bootstrap failures", async () => {
    const createWorkerApplication = vi.fn(async (env: Record<string, unknown>) => {
      await Promise.resolve();
      if (env.fail) throw new Error("private-bootstrap-cause");
      return { fetch: async () => Response.json({ owner: env.owner }) };
    });
    const exports: Record<string, unknown> = {};
    const source = readFileSync(
      new URL("../../templates/saas/apps/api-server/src/worker.ts", import.meta.url),
      "utf8",
    );
    const compiled = transpileModule(source, { compilerOptions: { module: ModuleKind.CommonJS } });
    runInNewContext(compiled.outputText, {
      exports,
      require: (specifier: string) => {
        if (specifier !== "./workerBootstrap") throw new Error(`Unexpected import: ${specifier}`);
        return {
          createWorkerApplication,
          workerProblemResponse: (code: string) => Response.json({ code }, { status: 500 }),
        };
      },
      WeakMap,
    });
    const worker = exports.default as {
      fetch: (
        request: Request,
        env: Record<string, unknown>,
        execution: object,
      ) => Promise<Response>;
    };
    const a = { owner: "A" };
    const b = { owner: "B" };
    const responses = await Promise.all(
      [a, a, b].map((env) => worker.fetch(new Request("https://worker.test/ops/health"), env, {})),
    );
    expect(await Promise.all(responses.map((response) => response.json()))).toEqual([
      { owner: "A" },
      { owner: "A" },
      { owner: "B" },
    ]);
    expect(createWorkerApplication).toHaveBeenCalledTimes(2);
    const failed = await worker.fetch(
      new Request("https://worker.test/ops/health"),
      { fail: true },
      {},
    );
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ code: "CROCO_SAAS_PROFILE_BOOTSTRAP_FAILED" });
  });
});
