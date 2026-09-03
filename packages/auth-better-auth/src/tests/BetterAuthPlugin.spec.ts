import { AUTH_PROVIDER_TOKEN } from "@croco/auth-core";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import { Container } from "@croco/framework-context";
import {
  createApplicationRuntime,
  defineCrocoApplication,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { describe, expect, it } from "vitest";
import { BETTER_AUTH_MODULE_NAME, betterAuth } from "../index";
import { BetterAuthDiagnosticsProvider } from "../libs/BetterAuthDiagnosticsProvider";
import { BetterAuthProvider } from "../libs/BetterAuthProvider";

describe("betterAuth", () => {
  it("owns the auth provider and diagnostics contribution in the application graph", async () => {
    const plugin = betterAuth({
      db: {} as never,
      baseURL: "https://auth.example.test",
      secret: "better-auth-secret",
      webhookSecret: "better-auth-webhook-secret",
    });
    const runtime = createApplicationRuntime(
      defineCrocoApplication({ name: "better-auth-test", imports: [plugin] }),
    );

    expect(Container.has(AUTH_PROVIDER_TOKEN)).toBe(false);
    await runtime.initialize();

    expect(runtime.get(AUTH_PROVIDER_TOKEN)).toBeInstanceOf(BetterAuthProvider);
    expect(
      runtime.getContributions<DiagnosticsProvider>(MODULE_CONTRIBUTION_KINDS.diagnosticsProvider),
    ).toEqual([
      {
        id: "@croco/auth-better-auth",
        kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
        moduleName: BETTER_AUTH_MODULE_NAME,
        order: 100,
        value: expect.any(BetterAuthDiagnosticsProvider),
      },
    ]);
    expect(runtime.createGraphManifest()).toMatchObject({
      applicationName: "better-auth-test",
      moduleGraph: {
        status: "ready",
        modules: [
          {
            name: BETTER_AUTH_MODULE_NAME,
            providers: [{ token: "AuthProvider", provider: "value" }],
            exports: ["AuthProvider"],
            contributions: [
              {
                id: "@croco/auth-better-auth",
                kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
                order: 100,
              },
            ],
          },
        ],
      },
    });
    expect(Container.has(AUTH_PROVIDER_TOKEN)).toBe(false);

    await runtime.dispose();
  });

  it("publishes complete metadata without serializing configuration values", () => {
    const plugin = betterAuth({
      db: {} as never,
      baseURL: "https://secret.example.test",
      secret: "never-serialize-secret",
      webhookSecret: "never-serialize-webhook",
    });

    expect(plugin.metadata).toEqual({
      name: "better-auth",
      packageName: "@croco/auth-better-auth",
      maturity: "production",
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
        { key: "db", required: true, description: "Application-owned Drizzle database client." },
        {
          key: "BETTER_AUTH_URL",
          required: true,
          description: "Public base URL used by Better Auth.",
        },
        {
          key: "BETTER_AUTH_SECRET",
          required: true,
          sensitive: true,
          description: "Secret used by Better Auth to sign and encrypt authentication data.",
        },
        {
          key: "BETTER_AUTH_WEBHOOK_SECRET",
          required: false,
          sensitive: true,
          description: "Optional webhook signing secret reported by readiness diagnostics.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/auth-better-auth test",
          reference: "packages/auth-better-auth/src/tests/BetterAuthPlugin.spec.ts",
        },
      ],
      examples: ["packages/auth-better-auth/README.md#application-plugin"],
    });
    expect(JSON.stringify(plugin.metadata)).not.toContain("secret.example.test");
    expect(JSON.stringify(plugin.metadata)).not.toContain("never-serialize");
  });
});
