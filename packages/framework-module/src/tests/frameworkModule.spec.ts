import 'reflect-metadata';
import { Container, Service as Component, Token } from 'typedi';
import { beforeEach, describe, expect, it } from 'vitest';
import { CrocoModule, ModuleContext, detectCircularDependency } from '../index';
import type { ModuleOptions } from '../types';

@Component()
class GreeterService {
  greet(): string {
    return 'hello';
  }
}

describe('CrocoModule', () => {
  beforeEach(() => {
    CrocoModule.reset();
    Container.reset();
  });

  it('registers a module with use', async () => {
    const calls: string[] = [];

    CrocoModule.use({
      name: 'app',
      setup: () => {
        calls.push('setup');
      },
    });

    await CrocoModule.initialize();

    expect(calls).toEqual(['setup']);
  });

  it('runs setup in dependency order', async () => {
    const calls: string[] = [];
    const database: ModuleOptions = {
      name: 'database',
      setup: () => {
        calls.push('database');
      },
    };
    const users: ModuleOptions = {
      name: 'users',
      imports: [database],
      setup: () => {
        calls.push('users');
      },
    };
    const api: ModuleOptions = {
      name: 'api',
      imports: [users],
      setup: () => {
        calls.push('api');
      },
    };

    CrocoModule.use(api);
    CrocoModule.use(users);
    CrocoModule.use(database);

    await CrocoModule.initialize();

    expect(calls).toEqual(['database', 'users', 'api']);
  });

  it('retrieves services from the container through ModuleContext.get', async () => {
    CrocoModule.use({
      name: 'app',
      setup: (ctx) => {
        expect(ctx.get(GreeterService).greet()).toBe('hello');
      },
    });

    await CrocoModule.initialize();
  });

  it('registers services in the container through ModuleContext.set', async () => {
    const token = new Token<{ readonly name: string }>('config');

    CrocoModule.use({
      name: 'config',
      setup: (ctx) => ctx.set(token, { name: 'croco' }),
      start: () => {
        expect(Container.get(token)).toEqual({ name: 'croco' });
      },
    });

    await CrocoModule.initialize();
  });

  it('runs setup before start', async () => {
    const calls: string[] = [];

    CrocoModule.use({
      name: 'app',
      setup: () => {
        calls.push('setup');
      },
      start: () => {
        calls.push('start');
      },
    });

    await CrocoModule.initialize();

    expect(calls).toEqual(['setup', 'start']);
  });

  it('throws an error for circular dependencies', () => {
    const moduleAImports: ModuleOptions[] = [];
    const moduleBImports: ModuleOptions[] = [];
    const moduleCImports: ModuleOptions[] = [];
    const moduleA: ModuleOptions = { name: 'A', setup: () => undefined, imports: moduleAImports };
    const moduleB: ModuleOptions = { name: 'B', setup: () => undefined, imports: moduleBImports };
    const moduleC: ModuleOptions = { name: 'C', setup: () => undefined, imports: moduleCImports };

    moduleAImports.push(moduleB);
    moduleBImports.push(moduleC);
    moduleCImports.push(moduleA);

    expect(() => detectCircularDependency([moduleA, moduleB, moduleC])).toThrow(
      'Circular dependency detected: A → B → C → A'
    );
  });

  it('does not throw for acyclic dependencies', () => {
    const moduleC: ModuleOptions = { name: 'C', setup: () => undefined };
    const moduleB: ModuleOptions = { name: 'B', setup: () => undefined, imports: [moduleC] };
    const moduleA: ModuleOptions = { name: 'A', setup: () => undefined, imports: [moduleB] };

    expect(detectCircularDependency([moduleA, moduleB, moduleC])).toBeNull();
  });

  it('throws a validation error when a module has no setup or start', () => {
    expect(() => CrocoModule.use({ name: 'empty' })).toThrow("Module 'empty' must define setup or start.");
  });

  it('returns ModuleContext when initialized', async () => {
    CrocoModule.use({
      name: 'app',
      setup: () => undefined,
    });

    const context = await CrocoModule.initialize();

    expect(context).toBeInstanceOf(ModuleContext);
  });
});
