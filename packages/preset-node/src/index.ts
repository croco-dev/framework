import { defineCrocoPreset, type CrocoPreset, type CrocoPresetConfig } from '@croco/framework-preset';

export type CreateNodeServerPresetOptions = {
  readonly port?: number;
  readonly hostname?: string;
};

export function createNodeServerPreset(options?: CreateNodeServerPresetOptions): CrocoPreset {
  void options;

  return defineCrocoPreset({
    name: 'node',
    entry: './entry.js',
    output: {
      dir: 'dist',
      format: 'dual',
    },
    hooks: {
      'dev:start': async () => {
        console.log('[node-preset] Dev server starting...');
      },
    },
  });
}

export { createNodeEntry } from './entry';
export type { NodeEntryOptions } from './entry';
export type { CrocoPreset, CrocoPresetConfig };
