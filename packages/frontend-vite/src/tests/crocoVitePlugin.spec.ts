import { describe, expect, it } from 'vitest';
import { crocoVitePlugin } from '../libs/crocoVitePlugin';

describe('crocoVitePlugin', () => {
  it('should return plugins array with cloudflare and vike by default', () => {
    const plugins = crocoVitePlugin();

    expect(Array.isArray(plugins)).toBe(true);
    expect(plugins.length).toBeGreaterThan(0);

    const hasCloudflare = plugins.some((p) => p.name?.includes('cloudflare'));
    expect(hasCloudflare).toBe(true);

    const hasVike = plugins.some((p) => p.name === undefined && '_vikeVitePluginOptions' in p);
    expect(hasVike).toBe(true);
  });

  it('should exclude cloudflare plugin when cloudflare: false', () => {
    const plugins = crocoVitePlugin({ cloudflare: false });

    expect(Array.isArray(plugins)).toBe(true);

    const hasCloudflare = plugins.some((p) => p.name?.includes('cloudflare'));
    expect(hasCloudflare).toBe(false);

    const hasVike = plugins.some((p) => p.name === undefined && '_vikeVitePluginOptions' in p);
    expect(hasVike).toBe(true);
  });

  it('should have no viteEnvironment option when ssr: false', () => {
    const plugins = crocoVitePlugin({ ssr: false });

    expect(Array.isArray(plugins)).toBe(true);

    const cloudflarePlugins = plugins.filter((p) => p.name?.includes('cloudflare'));
    expect(cloudflarePlugins.length).toBeGreaterThan(0);
  });
});
