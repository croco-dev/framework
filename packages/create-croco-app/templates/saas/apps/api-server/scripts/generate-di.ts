import { compileDiGraph, writeDiGraph, DEFAULT_DI_SCAN_EXCLUDES } from "@croco/esbuild-plugin";
import { diOptions } from "../di.config";

writeDiGraph(
  compileDiGraph({
    baseDir: process.cwd(),
    // Worker services have their own graph and native binding declarations.
    ...(process.argv.includes("--worker-tooling")
      ? { exclude: [...DEFAULT_DI_SCAN_EXCLUDES, "src/worker/**"] }
      : {}),
    modules: diOptions.modules,
    moduleProviders: diOptions.moduleProviders,
  }),
);
