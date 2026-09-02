import { AUTH_PROVIDER_TOKEN } from "@croco/auth-core";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
  type PluginFactory,
} from "@croco/framework-module";
import {
  ClerkAuthDiagnosticsProvider,
  type ClerkAuthDiagnosticsOptions,
} from "./ClerkAuthDiagnosticsProvider";
import { ClerkAuthProvider, type ClerkAuthOptions } from "./ClerkAuthProvider";

export type ClerkAuthPluginOptions = ClerkAuthOptions & {
  readonly webhookSecret?: string;
  readonly diagnostics?: ClerkAuthDiagnosticsOptions;
};

export const clerkAuth: PluginFactory<ClerkAuthPluginOptions> = (options) => {
  const authOptions: ClerkAuthOptions = Object.freeze({
    secretKey: options.secretKey,
    ...(options.publishableKey ? { publishableKey: options.publishableKey } : {}),
  });
  const diagnosticsProvider = new ClerkAuthDiagnosticsProvider(
    {
      secretKey: options.secretKey,
      publishableKey: options.publishableKey,
      webhookSecret: options.webhookSecret,
    },
    options.diagnostics,
  );

  return defineCrocoPlugin({
    metadata: {
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
    },
    modules: [
      defineCrocoModule({
        name: "auth-clerk",
        providers: [
          {
            provide: AUTH_PROVIDER_TOKEN,
            useFactory: () => new ClerkAuthProvider(authOptions),
          },
        ],
        exports: [AUTH_PROVIDER_TOKEN],
        contributions: [
          {
            id: "@croco/auth-clerk",
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            order: 100,
            value: diagnosticsProvider,
          },
        ],
      }),
    ],
  });
};
