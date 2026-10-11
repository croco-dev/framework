import { compileDiGraph, writeDiGraph } from "@croco/esbuild-plugin";

writeDiGraph(compileDiGraph({ baseDir: process.cwd() }));
