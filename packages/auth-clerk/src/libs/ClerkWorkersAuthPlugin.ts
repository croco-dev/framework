import { AUTH_PROVIDER_TOKEN } from "@croco/auth-core";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import { ClerkAuthDiagnosticsProvider } from "./ClerkAuthDiagnosticsProvider";
import { ClerkWorkersAuthProvider, type ClerkWorkersAuthOptions } from "./ClerkWorkersAuthProvider";

/** Opt-in Worker subset; does not install webhook handling or claim full SaaS composition. */
export function clerkWorkersAuth(options: ClerkWorkersAuthOptions) {
  const provider = new ClerkWorkersAuthProvider(options);
  return defineCrocoPlugin({
    metadata: {
      name: "auth-clerk-workers",
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
      runtimeCompatibility: ["cloudflare-workers"],
      configuration: [
        {
          key: "CLERK_SECRET_KEY",
          required: true,
          sensitive: true,
          description: "Clerk secret binding for signature and fresh session status verification.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/auth-clerk test",
          reference: "packages/auth-clerk/src/tests/ClerkWorkersAuthProvider.spec.ts",
        },
      ],
      examples: ["packages/auth-clerk/README.md#workers-authentication-subset"],
    },
    modules: [
      defineCrocoModule({
        name: "auth-clerk-workers",
        providers: [{ provide: AUTH_PROVIDER_TOKEN, useValue: provider }],
        exports: [AUTH_PROVIDER_TOKEN],
        contributions: [
          {
            id: "@croco/auth-clerk/workers",
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            order: 100,
            value: new ClerkAuthDiagnosticsProvider({
              secretKey: options.secretKey,
              publishableKey: options.publishableKey,
            }),
          },
        ],
      }),
    ],
  });
}
