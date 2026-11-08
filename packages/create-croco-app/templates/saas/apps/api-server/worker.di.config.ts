import type { DiCompilerOptions } from "@croco/esbuild-plugin";

const environment = "package:@croco/preset-cloudflare/application#CLOUDFLARE_ENV_TOKEN";

/** Worker-only scan roots keep Node SaaS providers out of the native bundle. */
export const workerDiOptions = {
  scanDirs: ["src/worker"],
  graphId: "worker-application",
  outFile: ".croco/worker-di.generated.ts",
  manifestFile: ".croco/worker-di.manifest.json",
  modules: [
    { id: "@croco/preset-cloudflare/host", providers: [environment], exports: [environment] },
  ],
  moduleProviders: [
    {
      token: {
        moduleSpecifier: "@croco/preset-cloudflare/application",
        exportName: "CLOUDFLARE_ENV_TOKEN",
      },
      moduleId: "@croco/preset-cloudflare/host",
      scope: "singleton",
    },
  ],
} satisfies DiCompilerOptions;
