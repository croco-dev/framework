import {
  type CrocoPreset,
  type CrocoPresetConfig,
  defineCrocoPreset,
} from "@croco/framework-preset";

export function createNodeServerPreset(): CrocoPreset {
  return defineCrocoPreset({
    name: "node",
    entry: "./entry.js",
    output: {
      dir: "dist",
      format: "dual",
    },
    hooks: {
      "dev:start": async () => {
        console.log("[node-preset] Dev server starting...");
      },
    },
  });
}

export type { NodeEntry, NodeEntryOptions } from "./entry";
export { createNodeEntry } from "./entry";
export type { CrocoPreset, CrocoPresetConfig };
