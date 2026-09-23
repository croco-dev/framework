import type { CrocoPluginConfig } from "@croco/esbuild-plugin";

const saasRuntimeState = {
  moduleSpecifier: "./src/saasDemo.ts",
  exportName: "SAAS_RUNTIME_STATE_TOKEN",
} as const;

export const diOptions = {
  modules: [
    {
      id: "saas-application",
      providers: ["app:src/saasDemo#SAAS_RUNTIME_STATE_TOKEN"],
      exports: ["app:src/saasDemo#SAAS_RUNTIME_STATE_TOKEN"],
    },
  ],
  moduleProviders: [{ token: saasRuntimeState, moduleId: "saas-application", scope: "singleton" }],
} satisfies NonNullable<CrocoPluginConfig["di"]>;
