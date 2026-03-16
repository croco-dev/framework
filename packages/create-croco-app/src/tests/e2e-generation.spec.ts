import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from '../generator.js';
import type { GeneratorOptions } from '../types.js';

describe('E2E: generate()', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('generates blank project', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-blank',
      scope: '@test',
      preset: 'blank',
      webApps: [],
      apiHosting: 'standalone',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, 'package.json'))).toBe(true);
    expect(existsSync(join(testDir, 'pnpm-workspace.yaml'))).toBe(true);
    expect(existsSync(join(testDir, 'turbo.json'))).toBe(true);
    expect(existsSync(join(testDir, 'tsconfig.json'))).toBe(true);
  });

  it('generates ddd-fullstack with graphql standalone + docker + postgres', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-fullstack',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web'],
      api: 'graphql',
      apiHosting: 'standalone',
      backendDeploy: 'docker',
      db: ['postgres'],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // Base DDD structure
    expect(existsSync(join(testDir, 'libs', 'shared'))).toBe(true);

    // GraphQL standalone API
    expect(existsSync(join(testDir, 'apps', 'graphql-api'))).toBe(true);

    // Web app (web-graphql addon)
    expect(existsSync(join(testDir, 'apps', 'web'))).toBe(true);

    // Docker files
    expect(existsSync(join(testDir, 'docker-compose.yml'))).toBe(true);
    expect(existsSync(join(testDir, '.dockerignore'))).toBe(true);
  });

  it('generates ddd-fullstack with trpc nextjs + vercel', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-trpc',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web'],
      api: 'trpc',
      apiHosting: 'nextjs',
      frontendDeploy: 'vercel',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // tRPC nextjs: Next.js 앱에 tRPC 내장
    expect(existsSync(join(testDir, 'apps', 'web'))).toBe(true);
    // Vercel config
    expect(existsSync(join(testDir, 'apps', 'web', 'vercel.json'))).toBe(true);
  });

  it('generates ddd-api with graphql + lambda + mongodb', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-api',
      scope: '@test',
      preset: 'ddd-api',
      webApps: [],
      api: 'graphql',
      apiHosting: 'standalone',
      backendDeploy: 'lambda',
      db: ['mongodb'],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // GraphQL API
    expect(existsSync(join(testDir, 'apps', 'graphql-api'))).toBe(true);
    const handlerContent = readFileSync(join(testDir, 'apps', 'graphql-api', 'src', 'handler.ts'), 'utf8');
    const schemaContent = readFileSync(join(testDir, 'apps', 'graphql-api', 'src', 'schema.ts'), 'utf8');
    const packageJsonContent = readFileSync(join(testDir, 'apps', 'graphql-api', 'package.json'), 'utf8');

    expect(handlerContent).toContain("from '@croco/telemetry-sdk-node';");
    expect(handlerContent).toContain("import { createSchema } from './schema.js';");
    expect(handlerContent).toContain('const telemetryReady = telemetry.init(');
    expect(handlerContent).toContain('let lambdaHandlerPromise');
    expect(handlerContent).toContain('function getLambdaHandler()');
    expect(handlerContent).toContain('await telemetryReady;');
    expect(handlerContent).toContain('const lambdaHandler = await getLambdaHandler();');
    expect(handlerContent).toContain('await telemetry.forceFlush();');
    expect(schemaContent).toContain('export async function createSchema()');
    expect(packageJsonContent).toContain('"@croco/telemetry-sdk-node": "workspace:*"');

    // Lambda SST
    expect(existsSync(join(testDir, 'sst.config.ts'))).toBe(true);
    // MongoDB provider
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-mongodb'))).toBe(true);
  });
});
