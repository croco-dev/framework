import {
  type CrocoPreset,
  type CrocoPresetConfig,
  defineCrocoPreset,
} from "@croco/framework-preset";

import type { LambdaPresetOptions } from "./types";

export type { LambdaPresetOptions };

export function createLambdaPreset(options?: LambdaPresetOptions): CrocoPreset {
  void options;

  return defineCrocoPreset({
    name: "lambda",
    entry: "./handler.js",
    output: {
      dir: "dist",
      format: "esm",
    },
    hooks: {
      "build:after": async () => {
        console.log("[lambda-preset] Build complete");
      },
    },
  });
}

export type { LambdaContext, LambdaEvent, LambdaHandler, LambdaResponse } from "./handler";
export { createLambdaHandler } from "./handler";
export type { CrocoPreset, CrocoPresetConfig };
