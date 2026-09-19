import type { ILogger } from "@croco/framework-context";
import { createApplicationRuntime } from "@croco/framework-module";
import type { CrocoApplicationDefinition } from "@croco/framework-module";

export type PackageReadiness = {
  readonly maturity: "alpha" | "beta" | "production";
  readonly certification: "certified" | "uncertified" | "not-recorded";
};

export const FIRST_PARTY_PACKAGE_READINESS = {
  "@croco/auth-better-auth": { maturity: "alpha", certification: "not-recorded" },
  "@croco/billing-polar": { maturity: "beta", certification: "uncertified" },
  "@croco/tasks-qstash": { maturity: "alpha", certification: "uncertified" },
  "@croco/telemetry-sdk-node": { maturity: "production", certification: "certified" },
  "@croco/transports-http": { maturity: "production", certification: "certified" },
  "@croco/tx-drizzle": { maturity: "production", certification: "not-recorded" },
} as const satisfies Readonly<Record<string, PackageReadiness>>;

export const exampleLogger: ILogger = {
  child: () => exampleLogger,
  debug: () => undefined,
  error: () => undefined,
  fatal: () => undefined,
  info: () => undefined,
  warn: () => undefined,
};

export function inspectApplication(application: CrocoApplicationDefinition) {
  const runtime = createApplicationRuntime(application);
  const graph = runtime.createGraphManifest();
  return {
    application: graph.applicationName,
    modules: graph.moduleGraph.modules.map(({ name }) => name),
    plugins: graph.plugins.map(({ name, packageName, maturity }) => ({
      name,
      packageName,
      pluginMaturity: maturity,
      packageReadiness:
        FIRST_PARTY_PACKAGE_READINESS[packageName as keyof typeof FIRST_PARTY_PACKAGE_READINESS],
    })),
  };
}
