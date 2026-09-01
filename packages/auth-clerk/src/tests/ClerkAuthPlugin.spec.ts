import { AUTH_PROVIDER_TOKEN } from "@croco/auth-core";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { describe, expect, it } from "vitest";
import { clerkAuth } from "../index";
import { ClerkAuthDiagnosticsProvider } from "../libs/ClerkAuthDiagnosticsProvider";
import { ClerkAuthProvider } from "../libs/ClerkAuthProvider";

describe("clerkAuth", () => {
  it("inserts the configured auth provider and diagnostics contribution into the application graph", async () => {
    const plugin = clerkAuth({
      secretKey: "sk_test_module_graph",
      publishableKey: "pk_test_module_graph",
      webhookSecret: "whsec_module_graph",
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "clerk-test", imports: [plugin] }),
    );

    await runtime.initialize();

    expect(runtime.get(AUTH_PROVIDER_TOKEN)).toBeInstanceOf(ClerkAuthProvider);
    expect(
      runtime.getContributions<DiagnosticsProvider>(MODULE_CONTRIBUTION_KINDS.diagnosticsProvider),
    ).toEqual([
      {
        id: "@croco/auth-clerk",
        kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
        moduleName: "auth-clerk",
        order: 100,
        value: expect.any(ClerkAuthDiagnosticsProvider),
      },
    ]);
    const manifest = runtime.createGraphManifest();
    expect(manifest).toMatchObject({
      applicationName: "clerk-test",
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: "auth-clerk",
            providers: [{ token: "AuthProvider", provider: "factory" }],
            exports: ["AuthProvider"],
            contributions: [
              {
                id: "@croco/auth-clerk",
                kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
                order: 100,
              },
            ],
          },
        ],
      },
      contributions: [
        {
          id: "@croco/auth-clerk",
          kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
          moduleName: "auth-clerk",
          order: 100,
        },
      ],
    });
    const serializedManifest = JSON.stringify(manifest);
    expect(serializedManifest).not.toContain("sk_test_module_graph");
    expect(serializedManifest).not.toContain("pk_test_module_graph");
    expect(serializedManifest).not.toContain("whsec_module_graph");

    await runtime.dispose();
  });

  it("reports complete inspectable metadata without exposing configuration values", () => {
    const secretKey = "sk_test_never_serialize";
    const webhookSecret = "whsec_never_serialize";
    const plugin = clerkAuth({ secretKey, publishableKey: "pk_test_public", webhookSecret });

    expect(plugin.metadata).toEqual({
      name: "auth-clerk",
      packageName: "@croco/auth-clerk",
      maturity: "alpha",
      providedContracts: [
        "@croco/auth-core/AuthProvider",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "auth.provider", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "CLERK_SECRET_KEY",
          required: true,
          sensitive: true,
          description: "Clerk secret key used to verify bearer tokens.",
        },
        {
          key: "CLERK_PUBLISHABLE_KEY",
          required: false,
          description: "Optional Clerk publishable key.",
        },
        {
          key: "CLERK_WEBHOOK_SECRET",
          required: false,
          sensitive: true,
          description: "Optional Clerk webhook signing secret reported by readiness diagnostics.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/auth-clerk test",
          reference: "packages/auth-clerk/src/tests/ClerkAuthPlugin.spec.ts",
        },
      ],
      examples: ["packages/auth-clerk/README.md#canonical-module-plugin"],
    });

    const serializedMetadata = JSON.stringify(plugin.metadata);
    expect(serializedMetadata).not.toContain(secretKey);
    expect(serializedMetadata).not.toContain(webhookSecret);
    expect(serializedMetadata).not.toContain("pk_test_public");
  });
});
