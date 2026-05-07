import { describe, expect, it } from 'vitest';
import type { CrocoPresetConfig } from '../index';
import { defineCrocoPreset } from '../index';

describe('defineCrocoPreset', () => {
  it('returns a preset with the configured name', () => {
    const preset = defineCrocoPreset({
      name: 'node',
      entry: 'src/server.ts',
      output: {
        dir: 'dist',
        format: 'dual',
      },
    });

    expect(preset.name).toBe('node');
    expect(preset.config.name).toBe('node');
  });

  it('freezes the preset config', () => {
    const preset = defineCrocoPreset({
      name: 'lambda',
      entry: 'src/handler.ts',
      output: {
        dir: 'dist',
        format: 'esm',
      },
    });

    expect(Object.isFrozen(preset)).toBe(true);
    expect(Object.isFrozen(preset.config)).toBe(true);
    expect(Object.isFrozen(preset.config.output)).toBe(true);
  });

  it('creates a new preset with merged config when extended', () => {
    const preset = defineCrocoPreset({
      name: 'node',
      entry: 'src/server.ts',
      output: {
        dir: 'dist',
        format: 'dual',
      },
    });

    const extended = preset.extend({
      name: 'worker',
      output: {
        dir: 'worker-dist',
        format: 'esm',
      },
    });

    expect(extended).not.toBe(preset);
    expect(extended.name).toBe('worker');
    expect(extended.config.entry).toBe('src/server.ts');
    expect(extended.config.output).toEqual({
      dir: 'worker-dist',
      format: 'esm',
    });
    expect(preset.config.output).toEqual({
      dir: 'dist',
      format: 'dual',
    });
  });

  it('uses an empty hooks object when hooks are omitted', () => {
    const preset = defineCrocoPreset({
      name: 'cloudflare',
      entry: 'src/worker.ts',
      output: {
        dir: 'dist',
        format: 'esm',
      },
    });

    expect(preset.hooks).toEqual({});
    expect(Object.isFrozen(preset.hooks)).toBe(true);
  });

  it('merges hooks at key level when extended with partial hooks', () => {
    const buildBefore = async (config: CrocoPresetConfig) => config;
    const originalBuildAfter = async (): Promise<void> => {};
    const newBuildAfter = async (): Promise<void> => {};

    const preset = defineCrocoPreset({
      name: 'node',
      entry: 'src/server.ts',
      output: {
        dir: 'dist',
        format: 'dual',
      },
      hooks: {
        'build:before': buildBefore,
        'build:after': originalBuildAfter,
      },
    });

    const extended = preset.extend({
      hooks: {
        'build:after': newBuildAfter,
      },
    });

    expect(extended.hooks['build:before']).toBe(buildBefore);
    expect(extended.hooks['build:after']).toBe(newBuildAfter);
    expect(preset.hooks['build:after']).toBe(originalBuildAfter);
    expect(Object.isFrozen(extended.hooks)).toBe(true);
  });
});
