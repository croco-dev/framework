import { beforeEach, describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { Component, Container, Context, MetadataStorage, Token } from '../index';
import { getComponentScope } from '../libs/decorators/Component';

class SimpleService {
  getValue(): string {
    return 'simple';
  }
}

describe('Container', () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  describe('set and get', () => {
    it('should set and retrieve an instance', () => {
      const service = new SimpleService();
      Container.set(SimpleService, service);

      const retrieved = Container.get(SimpleService);
      expect(retrieved).toBe(service);
      expect(retrieved.getValue()).toBe('simple');
    });

    it('should return same instance for singleton', () => {
      Container.register(SimpleService, 'singleton');
      Container.set(SimpleService, new SimpleService());

      const instance1 = Container.get(SimpleService);
      const instance2 = Container.get(SimpleService);

      expect(instance1).toBe(instance2);
    });
  });

  describe('getMany', () => {
    it('should retrieve multiple instances', () => {
      class ServiceA {
        getA() {
          return 'a';
        }
      }
      class ServiceB {
        getA() {
          return 'b';
        }
      }

      const a = new ServiceA();
      const b = new ServiceB();

      Container.set(ServiceA, a);
      Container.set(ServiceB, b);

      const [resultA, resultB] = Container.getMany([ServiceA, ServiceB]);
      expect(resultA).toBe(a);
      expect(resultB).toBe(b);
    });
  });

  describe('reset', () => {
    it('should clear all registered instances', () => {
      Container.set(SimpleService, new SimpleService());
      const beforeReset = Container.get(SimpleService);
      expect(beforeReset).not.toBeNull();

      Container.reset();
      Container.set(SimpleService, new SimpleService());
      const afterReset = Container.get(SimpleService);

      expect(beforeReset).not.toBe(afterReset);
    });
  });

  describe('remove', () => {
    it('should remove a registered class token from container', () => {
      const service = new SimpleService();
      Container.set(SimpleService, service);

      expect(Container.get(SimpleService)).toBe(service);

      Container.remove(SimpleService);

      expect(() => Container.get(SimpleService)).toThrow();
    });
  });

  describe('scopes', () => {
    it('should register component with scope', () => {
      Container.register(SimpleService, 'transient');

      expect(Container.getComponentMetadata(SimpleService)).toEqual({
        scope: 'transient',
        target: SimpleService,
      });
    });

    it('should keep request-scoped instances separate for same class names', () => {
      const UserServiceA = class UserService {
        readonly source = 'A';
      };
      const UserServiceB = class UserService {
        readonly source = 'B';
      };

      expect(UserServiceA.name).toBe('UserService');
      expect(UserServiceB.name).toBe('UserService');

      Container.register(UserServiceA, 'request');
      Container.register(UserServiceB, 'request');

      let serviceA!: InstanceType<typeof UserServiceA>;
      let serviceB!: InstanceType<typeof UserServiceB>;

      Context.run({ requestId: 'request-collision' }, () => {
        serviceA = Container.get(UserServiceA);
        serviceB = Container.get(UserServiceB);
      });

      expect(serviceA).not.toBe(serviceB);
      expect(serviceA).toBeInstanceOf(UserServiceA);
      expect(serviceB).toBeInstanceOf(UserServiceB);
    });

    it('should resolve optional dependency when registered', () => {
      const token = new Token<SimpleService>('optional.service');
      const service = new SimpleService();

      Container.set(token, service);

      expect(Container.getOptional(token)).toBe(service);
    });

    it('should return undefined for missing optional dependency', () => {
      const token = new Token<SimpleService>('optional.missing');

      expect(Container.getOptional(token)).toBeUndefined();
    });

    it('should register async provider and resolve the created instance', async () => {
      const token = new Token<SimpleService>('async.service');
      const factory = vi.fn(async () => new SimpleService());

      const instance = await Container.registerAsync(token, factory);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(Container.get(token)).toBe(instance);
      expect(instance.getValue()).toBe('simple');
    });

    it('should lazily initialize a provider once', () => {
      const token = new Token<SimpleService>('lazy.service');
      const factory = vi.fn(() => new SimpleService());

      Container.registerLazy(token, factory);

      const first = Container.get(token);
      const second = Container.get(token);

      expect(factory).toHaveBeenCalledTimes(1);
      expect(first).toBe(second);
    });
  });
});

describe('Context', () => {
  it('should not be active initially', () => {
    expect(Context.isActive()).toBe(false);
  });

  it('should run with context and provide requestId', async () => {
    const ctx = { requestId: 'test-123' };

    await Context.run(ctx, async () => {
      expect(Context.isActive()).toBe(true);
      expect(Context.getRequestId()).toBe('test-123');
      expect(Context.get()).toEqual(ctx);
    });
  });

  it('should not leak context outside run', async () => {
    const ctx = { requestId: 'test-456' };

    await Context.run(ctx, async () => {
      expect(Context.isActive()).toBe(true);
    });

    expect(Context.isActive()).toBe(false);
    expect(Context.getRequestId()).toBeNull();
  });

  it('should support nested contexts', async () => {
    const outer = { requestId: 'outer' };
    const inner = { requestId: 'inner' };

    await Context.run(outer, async () => {
      expect(Context.getRequestId()).toBe('outer');

      await Context.run(inner, async () => {
        expect(Context.getRequestId()).toBe('inner');
      });

      expect(Context.getRequestId()).toBe('outer');
    });
  });

  it('should provide createdAt timestamp', async () => {
    const ctx = { requestId: 'timestamp-test' };
    const before = Date.now();

    await Context.run(ctx, async () => {
      const createdAt = Context.getCreatedAt();
      expect(typeof createdAt).toBe('number');
      expect(createdAt).toBeGreaterThanOrEqual(before);
    });
  });

  it('should return null for traceId when no active span and no traceId in context', async () => {
    const ctx = { requestId: 'test-123' };

    await Context.run(ctx, async () => {
      const traceId = Context.getActiveTraceId();
      expect(traceId).toBeNull();
    });
  });

  it('should return traceId from RequestContext when no active span', async () => {
    const ctx = { requestId: 'test-456', traceId: 'propagated-trace-123' };

    await Context.run(ctx, async () => {
      const traceId = Context.getActiveTraceId();
      expect(traceId).toBe('propagated-trace-123');
    });
  });

  describe('runWithMiddleware', () => {
    it('should call onRequestError for non-Error throws with a normalized Error', async () => {
      const onRequestError = vi.fn();
      const thrownValue = 'non-error failure';

      await expect(
        Context.runWithMiddleware({ requestId: 'middleware-err-1' }, [], { onRequestError }, async () => {
          throw thrownValue;
        })
      ).rejects.toBe(thrownValue);

      expect(onRequestError).toHaveBeenCalledWith(
        { requestId: 'middleware-err-1' },
        expect.objectContaining({
          message: 'non-error failure',
        })
      );
      expect(onRequestError.mock.calls[0]?.[1]).toBeInstanceOf(Error);
    });

    it('should preserve the original Error instance for onRequestError', async () => {
      const onRequestError = vi.fn();
      const originalError = new Error('boom');

      await expect(
        Context.runWithMiddleware({ requestId: 'middleware-err-2' }, [], { onRequestError }, async () => {
          throw originalError;
        })
      ).rejects.toBe(originalError);

      expect(onRequestError).toHaveBeenCalledWith({ requestId: 'middleware-err-2' }, originalError);
    });
  });
});

describe('MetadataStorage', () => {
  const TEST_KEY = Symbol('test');

  beforeEach(() => {
    MetadataStorage.clear();
  });

  it('should define and retrieve metadata', () => {
    class Target {}
    MetadataStorage.define(TEST_KEY, Target, { value: 42 });

    const result = MetadataStorage.get(TEST_KEY, Target);
    expect(result).toEqual({ value: 42 });
  });

  it('should check if metadata exists', () => {
    class Target {}

    expect(MetadataStorage.has(TEST_KEY, Target)).toBe(false);
    MetadataStorage.define(TEST_KEY, Target, 'data');
    expect(MetadataStorage.has(TEST_KEY, Target)).toBe(true);
  });

  it('should get all metadata for a key', () => {
    class Target1 {}
    class Target2 {}

    MetadataStorage.define(TEST_KEY, Target1, 'value1');
    MetadataStorage.define(TEST_KEY, Target2, 'value2');

    const all = MetadataStorage.getAll(TEST_KEY);
    expect(all).toHaveLength(2);
  });

  it('should delete metadata', () => {
    class Target {}
    MetadataStorage.define(TEST_KEY, Target, 'data');

    expect(MetadataStorage.has(TEST_KEY, Target)).toBe(true);
    MetadataStorage.delete(TEST_KEY, Target);
    expect(MetadataStorage.has(TEST_KEY, Target)).toBe(false);
  });

  it('should clear all metadata', () => {
    class Target {}
    MetadataStorage.define(TEST_KEY, Target, 'data');
    MetadataStorage.clear();

    expect(MetadataStorage.has(TEST_KEY, Target)).toBe(false);
  });

  it('should reset target indexes when clearing metadata', () => {
    type InspectableMetadataStorage = {
      define: <T>(key: symbol, target: object, value: T, propertyKey?: string | symbol) => void;
      clear: () => void;
      getAll: <T>(key: symbol) => Array<{ target: object; propertyKey?: string | symbol; value: T }>;
      makeKey: (key: symbol, target: object, propertyKey?: string | symbol) => string;
    };

    class FirstTarget {}
    class SecondTarget {}

    const inspectableStorage = MetadataStorage as unknown as InspectableMetadataStorage;

    inspectableStorage.define(TEST_KEY, FirstTarget, 'first');
    expect(inspectableStorage.makeKey(TEST_KEY, FirstTarget)).toContain('::1::');

    inspectableStorage.clear();

    inspectableStorage.define(TEST_KEY, SecondTarget, 'second');

    expect(inspectableStorage.getAll<string>(TEST_KEY)).toEqual([
      { target: SecondTarget, propertyKey: undefined, value: 'second' },
    ]);
    expect(inspectableStorage.makeKey(TEST_KEY, SecondTarget)).toContain('::1::');
  });

  it('should keep distinct symbols with same description isolated', () => {
    type InspectableMetadataStorage = {
      define: <T>(key: symbol, target: object, value: T, propertyKey?: string | symbol) => void;
      get: <T>(key: symbol, target: object, propertyKey?: string | symbol) => T | undefined;
      getAll: <T>(key: symbol) => Array<{ target: object; propertyKey?: string | symbol; value: T }>;
      makeKey: (key: symbol, target: object, propertyKey?: string | symbol) => string;
    };

    class Target {}

    const firstKey = Symbol('duplicate');
    const secondKey = Symbol('duplicate');
    const inspectableStorage = MetadataStorage as unknown as InspectableMetadataStorage;

    inspectableStorage.define(firstKey, Target, 'first-value');
    inspectableStorage.define(secondKey, Target, 'second-value');

    expect(inspectableStorage.get(firstKey, Target)).toBe('first-value');
    expect(inspectableStorage.get(secondKey, Target)).toBe('second-value');
    expect(inspectableStorage.getAll<string>(firstKey)).toEqual([
      { target: Target, propertyKey: undefined, value: 'first-value' },
    ]);
    expect(inspectableStorage.getAll<string>(secondKey)).toEqual([
      { target: Target, propertyKey: undefined, value: 'second-value' },
    ]);
    expect(inspectableStorage.makeKey(firstKey, Target)).not.toBe(inspectableStorage.makeKey(secondKey, Target));
  });
});

describe('Component decorator', () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it('should register component with default singleton scope', () => {
    @Component()
    class SingletonService {}

    const scope = getComponentScope(SingletonService);
    expect(scope).toBe('singleton');
  });

  it('should register component with specified scope', () => {
    @Component({ scope: 'transient' })
    class TransientService {}

    const scope = getComponentScope(TransientService);
    expect(scope).toBe('transient');
  });

  it('should register component with request scope', () => {
    @Component({ scope: 'request' })
    class RequestService {}

    const scope = getComponentScope(RequestService);
    expect(scope).toBe('request');
  });

  it('should expose component metadata through Container public API', () => {
    @Component({ scope: 'transient' })
    class MetadataService {}

    const metadata = Container.getComponentMetadata(MetadataService);
    expect(metadata?.scope).toBe('transient');
    expect(metadata?.target).toBe(MetadataService);
  });
});
