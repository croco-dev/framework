import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from '../generator.js';
import type { GeneratorOptions } from '../types.js';

describe('E2E Vite SPA: generate()', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-vite-spa-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('generates vite spa frontend deploy files for standalone web app', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-vite-spa',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web'],
      api: 'graphql',
      apiHosting: 'standalone',
      frontendDeploy: 'vite-spa',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    const appDir = join(testDir, 'apps', 'web');
    const viteConfigContent = readFileSync(join(appDir, 'vite.config.ts'), 'utf8');
    const packageJsonContent = readFileSync(join(appDir, 'package.json'), 'utf8');
    const clientContent = readFileSync(join(appDir, 'src', 'api', 'client.ts'), 'utf8');

    expect(existsSync(join(appDir, 'vite.config.ts'))).toBe(true);
    expect(existsSync(join(appDir, 'package.json'))).toBe(true);
    expect(existsSync(join(appDir, 'src', 'main.tsx'))).toBe(true);
    expect(existsSync(join(appDir, 'src', 'App.tsx'))).toBe(true);
    expect(existsSync(join(appDir, 'src', 'api', 'client.ts'))).toBe(true);
    expect(existsSync(join(appDir, 'index.html'))).toBe(true);

    expect(clientContent).toContain('VITE_API_URL');
    expect(clientContent).toContain('window.location.origin');
    expect(viteConfigContent).toContain('crocoSpaViteConfig');
    expect(packageJsonContent).toContain('"vite": "^6.0.0"');
  });
});
