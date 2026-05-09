import type { CrocoPreset, CrocoPresetConfig, HookMap } from './types';

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
    extend: (partial: Partial<CrocoPresetConfig>): CrocoPreset => {
      return defineCrocoPreset({
        ...presetConfig,
        ...partial,
        output: {
          ...presetConfig.output,
          ...partial.output,
        },
        hooks: { ...presetConfig.hooks, ...partial.hooks },
      });
    },
  });
}

export type { CrocoPreset, CrocoPresetConfig, HookMap } from './types';
