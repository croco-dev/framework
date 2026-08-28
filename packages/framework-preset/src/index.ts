import type { CrocoPreset, CrocoPresetConfig, CrocoPresetOverride, HookMap } from "./types";

const EMPTY_HOOKS: Readonly<HookMap> = Object.freeze({});

export function defineCrocoPreset(config: CrocoPresetConfig): CrocoPreset {
  const hooks = Object.freeze(config.hooks ?? EMPTY_HOOKS);
  const presetConfig = Object.freeze({
    ...config,
    output: Object.freeze({ ...config.output }),
    hooks,
  });

  return Object.freeze({
    config: presetConfig,
    name: presetConfig.name,
    hooks,
    extend: (override: CrocoPresetOverride): CrocoPreset => {
      return defineCrocoPreset({
        ...presetConfig,
        ...override,
        output: {
          ...presetConfig.output,
          ...override.output,
        },
        hooks: { ...presetConfig.hooks, ...override.hooks },
      });
    },
  });
}

export type { CrocoPreset, CrocoPresetConfig, CrocoPresetOverride, HookMap } from "./types";
