import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { generate } from '../generator.js';
import type { GeneratorOptions } from '../types.js';

describe('E2E Advanced: generate()', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = `/tmp/croco-e2e-adv-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it('generates graphql + nextjs hosting + opennext deploy', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-gql-next',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web'],
      api: 'graphql',
      apiHosting: 'nextjs',
      frontendDeploy: 'opennext',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // GraphQL nextjs: Next.js app with Apollo
    expect(existsSync(join(testDir, 'apps', 'web'))).toBe(true);
    // OpenNext config
    expect(existsSync(join(testDir, 'apps', 'web', 'open-next.config.ts'))).toBe(true);
  });

  it('generates trpc + multiple webapps + lambda + all DBs', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-multi',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web1', 'web2'],
      api: 'trpc',
      apiHosting: 'standalone',
      backendDeploy: 'lambda',
      db: ['postgres', 'mongodb', 'redis'],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    // tRPC standalone API
    expect(existsSync(join(testDir, 'apps', 'api'))).toBe(true);
    // Multiple web apps
    expect(existsSync(join(testDir, 'apps', 'web1'))).toBe(true);
    expect(existsSync(join(testDir, 'apps', 'web2'))).toBe(true);
    // Lambda
    expect(existsSync(join(testDir, 'sst.config.ts'))).toBe(true);
    // All DBs
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-mongodb'))).toBe(true);
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-redis'))).toBe(true);
  });

  it('generates graphql + docker + all DBs + agent-rules', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-full',
      scope: '@test',
      preset: 'ddd-fullstack',
      webApps: ['web'],
      api: 'graphql',
      apiHosting: 'standalone',
      backendDeploy: 'docker',
      db: ['postgres', 'mongodb', 'redis'],
      agentRules: true,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, '.agent', 'rules'))).toBe(true);
    expect(existsSync(join(testDir, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(testDir, 'docker-compose.yml'))).toBe(true);
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-mongodb'))).toBe(true);
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-redis'))).toBe(true);
  });

  it('generates ddd-api with no DBs and no agent-rules', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-clean-api',
      scope: '@test',
      preset: 'ddd-api',
      webApps: [],
      api: 'trpc',
      apiHosting: 'standalone',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    await generate(testDir, options);

    expect(existsSync(join(testDir, 'apps', 'api'))).toBe(true);
    expect(existsSync(join(testDir, '.agent'))).toBe(false);
    expect(existsSync(join(testDir, 'libs', 'shared', 'provider-mongodb'))).toBe(false);
  });

  it('throws error for non-empty directory', { timeout: 120_000 }, async () => {
    const options: GeneratorOptions = {
      projectName: 'my-conflict',
      scope: '@test',
      preset: 'blank',
      webApps: [],
      apiHosting: 'standalone',
      db: [],
      agentRules: false,
      installDeps: false,
      initGit: false,
    };

    // Generate once
    await generate(testDir, options);

    // Try to generate again into same non-empty dir — should throw
    await expect(generate(testDir, options)).rejects.toThrow('not empty');
  });
});
