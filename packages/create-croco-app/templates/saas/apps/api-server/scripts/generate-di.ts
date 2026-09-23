import { compileDiGraph, writeDiGraph } from "@croco/esbuild-plugin";
import { diOptions } from "../di.config";

writeDiGraph(
  compileDiGraph({
    baseDir: process.cwd(),
    modules: diOptions.modules,
    moduleProviders: diOptions.moduleProviders,
  }),
);
