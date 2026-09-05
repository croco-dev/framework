import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import { Container } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { STORAGE_PROVIDER_TOKEN } from "@croco/storage-core";
import { v2 as cloudinary } from "cloudinary";
import { describe, expect, it, vi } from "vitest";
import { CLOUDINARY_STORAGE_MODULE_NAME, cloudinaryStorage } from "../index";
import { CloudinaryDiagnosticsProvider } from "../libs/CloudinaryDiagnosticsProvider";
import { CloudinaryProvider } from "../libs/CloudinaryProvider";

describe("cloudinaryStorage", () => {
  it("owns storage and diagnostics in the graph without making live calls", async () => {
    const configSpy = vi.spyOn(cloudinary, "config");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const plugin = cloudinaryStorage({
      cloudName: "module-graph-cloud",
      apiKey: "module-graph-key",
      apiSecret: "module-graph-secret",
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "cloudinary-test", imports: [plugin] }),
    );

    expect(Container.has(STORAGE_PROVIDER_TOKEN)).toBe(false);
    await runtime.initialize();

    expect(runtime.get(STORAGE_PROVIDER_TOKEN)).toBeInstanceOf(CloudinaryProvider);
    const diagnostics = runtime.getContributions<DiagnosticsProvider>(
      MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
    );
    expect(diagnostics).toEqual([
      {
        id: "@croco/storage-cloudinary",
        kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
        moduleName: CLOUDINARY_STORAGE_MODULE_NAME,
        order: 100,
        value: expect.any(CloudinaryDiagnosticsProvider),
      },
    ]);
    expect(runtime.createGraphManifest()).toMatchObject({
      applicationName: "cloudinary-test",
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: CLOUDINARY_STORAGE_MODULE_NAME,
            providers: [{ token: "StorageProvider", provider: "value" }],
            exports: ["StorageProvider"],
            contributions: [
              {
                id: "@croco/storage-cloudinary",
                kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
                order: 100,
              },
            ],
          },
        ],
      },
    });
    expect(Container.has(STORAGE_PROVIDER_TOKEN)).toBe(false);
    await expect(diagnostics[0]?.value.getHealth()).resolves.toMatchObject({
      status: "healthy",
      details: { liveCheck: "not_configured" },
    });
    expect(configSpy).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();

    await runtime.dispose();
    vi.restoreAllMocks();
  });

  it("publishes exact production metadata without serializing credentials", () => {
    const plugin = cloudinaryStorage({
      cloudName: "never-serialize-cloud",
      apiKey: "never-serialize-key",
      apiSecret: "never-serialize-secret",
    });

    expect(plugin.metadata).toEqual({
      name: "cloudinary-storage",
      packageName: "@croco/storage-cloudinary",
      maturity: "production",
      providedContracts: [
        "@croco/storage-core/StorageProvider",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "storage.provider", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "CLOUDINARY_URL",
          required: true,
          sensitive: true,
          description:
            "Standard Cloudinary URL parsed by the application into cloudName, apiKey, and apiSecret options.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/storage-cloudinary test",
          reference: "packages/storage-cloudinary/src/tests/CloudinaryStoragePlugin.spec.ts",
        },
      ],
      examples: ["packages/storage-cloudinary/README.md#application-plugin"],
    });
    expect(JSON.stringify(plugin.metadata)).not.toContain("never-serialize");
  });
});
