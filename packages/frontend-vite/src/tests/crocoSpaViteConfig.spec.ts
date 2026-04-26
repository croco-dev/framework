import { describe, expect, it } from 'vitest';
import { crocoSpaViteConfig } from '../libs/crocoSpaViteConfig';

describe('crocoSpaViteConfig', () => {
  it('should return plugins array without options', () => {
    const result = crocoSpaViteConfig();

    expect(Array.isArray(result)).toBe(true);
  });

  it('should not include vike-related plugins', () => {
    const plugins = crocoSpaViteConfig();

    const hasVike = plugins.some((p) => p.name === undefined && '_vikeVitePluginOptions' in p);
    expect(hasVike).toBe(false);

    const hasCloudflare = plugins.some((p) => p.name?.includes('cloudflare'));
    expect(hasCloudflare).toBe(false);
  });

  it('should accept custom options', () => {
    const plugins = crocoSpaViteConfig({
      outDir: 'build',
      base: '/custom/',
      envPrefix: ['CUSTOM_'],
    });

    expect(Array.isArray(plugins)).toBe(true);
  });
});
