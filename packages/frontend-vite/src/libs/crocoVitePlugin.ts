import { cloudflare } from '@cloudflare/vite-plugin';
import vike from 'vike/plugin';
import type { Plugin } from 'vite';
import type { CrocoViteOptions } from './types';

export function crocoVitePlugin(options: CrocoViteOptions = {}): Plugin[] {
  const { ssr = true, cloudflare: useCloudflare = true } = options;
  const plugins: Plugin[] = [];

  if (useCloudflare) {
    plugins.push(...cloudflare({ viteEnvironment: ssr ? { name: 'ssr' } : undefined }));
  }

  plugins.push(vike({ prerender: false }) as unknown as Plugin);

  return plugins;
}
