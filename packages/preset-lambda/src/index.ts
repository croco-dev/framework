import {
  type CrocoPreset,
  type CrocoPresetConfig,
  defineCrocoPreset,
} from "@croco/framework-preset";

export type LambdaPresetOptions = {
  readonly region?: string;
  readonly timeout?: number;
};

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
