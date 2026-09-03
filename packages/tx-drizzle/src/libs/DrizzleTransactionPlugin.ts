import type { DiagnosticsProvider, HealthStatus } from "@croco/diagnostics-core";
import {
  defineCrocoModule,
  defineCrocoPlugin,
  MODULE_CONTRIBUTION_KINDS,
  type CrocoPlugin,
  type PluginFactory,
} from "@croco/framework-module";
import { TxManager } from "@croco/tx-core";
import type { TxManagerConfig } from "@croco/tx-core";
import { DrizzleHealthIndicator } from "./DrizzleHealthIndicator";
import type { DrizzleHealthIndicatorOptions } from "./DrizzleHealthIndicator";
import { createDrizzleTxAdapter } from "./DrizzleTxAdapter";
import type { DrizzleDb, InferTxClient, InferTxOptions } from "./types";

export const DRIZZLE_TRANSACTION_MODULE_NAME = "@croco/tx-drizzle/transaction";
const DRIZZLE_DIAGNOSTICS_CONTRIBUTION_ID = "@croco/tx-drizzle/database";

export type DrizzleTransactionPluginOptions<TDb extends DrizzleDb = DrizzleDb> = {
  readonly db: TDb;
  readonly transaction?: TxManagerConfig;
  readonly diagnostics?: DrizzleHealthIndicatorOptions;
  readonly shutdown?: () => void | Promise<void>;
};

class DrizzleDiagnosticsProvider implements DiagnosticsProvider {
  readonly name: string;

  constructor(
    private readonly indicator: DrizzleHealthIndicator,
    componentName = "database",
  ) {
    this.name = `${componentName}.drizzle`;
  }

  async getHealth(): Promise<HealthStatus> {
    const result = await this.indicator.check();
    const lastChecked = new Date().toISOString();

    if (result.status === "up") {
      return {
        status: "healthy",
        component: result.name,
        ...(result.details ? { details: result.details } : {}),
        lastChecked,
      };
    }

    const message = result.details?.["error"];
    return {
      status: "unhealthy",
      component: result.name,
      ...(typeof message === "string" ? { message } : {}),
      ...(result.details ? { details: result.details } : {}),
      lastChecked,
    };
  }
}

function createDrizzleTransactionPlugin<TDb extends DrizzleDb>(
  options: DrizzleTransactionPluginOptions<TDb>,
): CrocoPlugin {
  const diagnosticsName = options.diagnostics?.name ?? "database";
  const diagnosticsProvider = new DrizzleDiagnosticsProvider(
    new DrizzleHealthIndicator(options.db, options.diagnostics),
    diagnosticsName,
  );

  return defineCrocoPlugin({
    metadata: {
      name: "drizzle-transaction",
      packageName: "@croco/tx-drizzle",
      maturity: "production",
      providedContracts: [
        "@croco/tx-core/TxManager",
        "@croco/diagnostics-core/DiagnosticsProvider",
      ],
      capabilities: [
        { id: "transaction.manager", kind: "single" },
        { id: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider, kind: "multi" },
      ],
      runtimeCompatibility: ["node", "lambda"],
      configuration: [
        {
          key: "db",
          required: true,
          description: "Application-owned Drizzle database client.",
        },
        {
          key: "transaction",
          required: false,
          description: "TxManager nesting and timeout configuration.",
        },
        {
          key: "diagnostics.name",
          required: false,
          description: "Stable diagnostics component name.",
        },
        {
          key: "shutdown",
          required: false,
          description: "Application-owned database resource cleanup.",
        },
      ],
      verification: [
        {
          command: "pnpm --filter @croco/tx-drizzle test",
          reference: "packages/tx-drizzle/src/tests/DrizzleTransactionPlugin.spec.ts",
        },
      ],
      examples: ["packages/tx-drizzle/README.md#application-plugin"],
    },
    modules: [
      defineCrocoModule({
        name: DRIZZLE_TRANSACTION_MODULE_NAME,
        providers: [
          {
            provide: TxManager,
            useFactory: () =>
              new TxManager<InferTxClient<TDb>, InferTxOptions<TDb>>(
                createDrizzleTxAdapter(options.db),
                options.transaction,
              ),
          },
        ],
        exports: [TxManager],
        contributions: [
          {
            kind: MODULE_CONTRIBUTION_KINDS.diagnosticsProvider,
            id: DRIZZLE_DIAGNOSTICS_CONTRIBUTION_ID,
            order: 100,
            value: diagnosticsProvider,
          },
        ],
        ...(options.shutdown === undefined ? {} : { shutdown: options.shutdown }),
      }),
    ],
  });
}

export const drizzleTransaction: PluginFactory<DrizzleTransactionPluginOptions> =
  createDrizzleTransactionPlugin;
