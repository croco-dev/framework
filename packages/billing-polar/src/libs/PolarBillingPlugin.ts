import { BILLING_GATEWAY_TOKEN } from "@croco/billing-core";
import type { DiagnosticsProvider } from "@croco/diagnostics-core";
import type { ILogger } from "@croco/framework-context";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
} from "@croco/framework-module";
import type { PluginFactory } from "@croco/framework-module";
import type { PolarConfig } from "../types";
import {
  PolarBillingDiagnosticsProvider,
  type PolarBillingDiagnosticsOptions,
} from "./PolarBillingDiagnosticsProvider";
import { PolarBillingGateway } from "./PolarBillingGateway";

export const POLAR_BILLING_MODULE_NAME = "@croco/billing-polar/gateway";
const POLAR_BILLING_DIAGNOSTICS_CONTRIBUTION_ID = "@croco/billing-polar";

export type PolarBillingPluginOptions = PolarConfig & {
  readonly logger: ILogger;
  readonly diagnostics?: PolarBillingDiagnosticsOptions;
};

export const polarBilling: PluginFactory<PolarBillingPluginOptions> = (options) => {
  const config: PolarConfig = Object.freeze({
    accessToken: options.accessToken,
    environment: options.environment,
    webhookSecret: options.webhookSecret,
    ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    ...(options.checkoutRecovery ? { checkoutRecovery: options.checkoutRecovery } : {}),
  });
  const diagnosticsProvider = new PolarBillingDiagnosticsProvider(config, options.diagnostics);

  return defineCrocoPlugin({
    metadata: {
      name: "polar-billing",
      packageName: "@croco/billing-polar",
      maturity: "beta",
      providedContracts: [
        "@croco/billing-core/BillingGateway",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "billing.gateway", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "POLAR_ACCESS_TOKEN",
          required: true,
          sensitive: true,
          description: "Polar access token used by the billing gateway.",
        },
        {
          key: "POLAR_WEBHOOK_SECRET",
          required: true,
          sensitive: true,
          description: "Polar webhook signing secret used by webhook verification.",
        },
        {
          key: "POLAR_ENVIRONMENT",
          required: true,
          description: "Polar sandbox or production environment.",
        },
        {
          key: "POLAR_ORGANIZATION_ID",
          required: false,
          description: "Optional Polar organization scope.",
        },
        {
          key: "logger",
          required: true,
          description: "Application-owned logger passed explicitly by the composition root.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/billing-polar test",
          reference: "packages/billing-polar/src/tests/PolarBillingPlugin.spec.ts",
        },
      ],
      examples: ["packages/billing-polar/README.md#canonical-module-plugin"],
    },
    modules: [
      defineCrocoModule({
        name: POLAR_BILLING_MODULE_NAME,
        providers: [
          {
            provide: BILLING_GATEWAY_TOKEN,
            useFactory: () => new PolarBillingGateway(config, options.logger),
          },
        ],
        exports: [BILLING_GATEWAY_TOKEN],
        contributions: [
          {
            id: POLAR_BILLING_DIAGNOSTICS_CONTRIBUTION_ID,
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            order: 100,
            value: diagnosticsProvider satisfies DiagnosticsProvider,
          },
        ],
      }),
    ],
  });
};
