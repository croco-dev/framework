import 'reflect-metadata';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { CompiledController } from '../compiler';
import { compileRoutes, generateModule, generateRouteRegistrationCode } from '../compiler';

describe('compiler', () => {
  const mockControllers: readonly CompiledController[] = [
    {
      basePath: '/api',
      className: 'SampleController',
      routes: [
        { method: 'GET', path: '/hello', handlerName: 'hello' },
        { method: 'POST', path: '/users', handlerName: 'createUser' },
      ],
    },
  ];

  it('generates registerRoutes function', () => {
    const code = generateModule(mockControllers);

    expect(code).toContain('function registerRoutes');
    expect(code).toContain('app.get');
    expect(code).toContain("'/api/hello'");
    expect(code).toContain("'/api/users'");
  });

  it('generates all routes from controller metadata', () => {
    const code = generateRouteRegistrationCode(mockControllers);
    const lines = code.split('\n').filter((line) => line.includes('app.'));

    expect(lines).toHaveLength(2);
  });

  it('handles empty controller list', () => {
    const code = generateModule([]);

    expect(code).toContain('function registerRoutes');
    expect(code).toContain('app)');
  });

  it('writes routes.js with Hono route registrations', async () => {
    const outputDir = await mkdtemp(join(tmpdir(), 'croco-framework-routes-'));

    try {
      const moduleUrl = new URL('./fixtures/SampleController.ts', import.meta.url).href;

      await compileRoutes({ controllerPaths: [moduleUrl], outputDir });

      const code = await readFile(join(outputDir, '.croco', 'build', 'routes.js'), 'utf-8');

      expect(code).toContain('export function registerRoutes(app)');
      expect(code).toContain("app.get('/api/hello'");
      expect(code).toContain("app.post('/api/users'");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it('keeps reflect-metadata external in the bundle config', async () => {
    const config = await readFile(new URL('../../tsup.config.ts', import.meta.url), 'utf-8');

    expect(config).toContain("external: ['reflect-metadata']");
  });
});
