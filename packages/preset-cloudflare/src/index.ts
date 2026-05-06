import { defineCrocoPreset, type CrocoPreset } from '@croco/framework-preset';

export type CloudflarePresetOptions = {
  readonly name?: string;
  readonly entry?: string;
};

export function createCloudflarePreset(options?: CloudflarePresetOptions): CrocoPreset {
  return defineCrocoPreset({
    name: options?.name ?? 'cloudflare',
    entry: options?.entry ?? './fetch.js',
    output: {
      dir: 'dist',
      format: 'esm',
    },
    hooks: {
      'build:before': (config) => {
        console.log('[cloudflare-preset] Building for Cloudflare Workers (1MB limit)');
        return config;
      },
    },
  });
}

export { createWorkerFetchHandler } from './fetch';
export type { CloudflareFetchEnv, CloudflareFetchHandler } from './fetch';
