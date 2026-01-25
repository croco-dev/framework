import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Container } from './Container';
import { Context } from './Context';
import { Component } from './decorators/Component';

describe('Container.getRequestScoped', () => {
  beforeEach(() => {
    Container.reset();
  });

  it('should return same instance within Context.run()', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: 'test-1' }, () => {
      instance1 = Container.get(MyService);
      instance2 = Container.get(MyService);
    });

    expect(instance1).toBe(instance2);
  });

  it('should return different instances for different requests', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: 'req-1' }, () => {
      instance1 = Container.get(MyService);
    });

    Context.run({ requestId: 'req-2' }, () => {
      instance2 = Container.get(MyService);
    });

    expect(instance1).not.toBe(instance2);
  });

  it('should warn and return transient when called outside Context', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Mock console.warn to avoid output
    });

    const instance = Container.get(MyService);

    expect(warnSpy).toHaveBeenCalledWith(
      '[Container] getRequestScoped called outside Context.run(). Returning transient instance.'
    );
    expect(instance).toBeDefined();

    warnSpy.mockRestore();
  });

  it('should return different instances when called outside Context for request-scoped services', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {
      // Mock console.warn to avoid output
    });

    const instance1 = Container.get(MyService);
    const instance2 = Container.get(MyService);

    expect(instance1).not.toBe(instance2);

    warnSpy.mockRestore();
  });

  it('should work with nested Context.run() calls', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    let outerInstance!: MyService;
    let innerInstance!: MyService;

    Context.run({ requestId: 'outer' }, () => {
      outerInstance = Container.get(MyService);

      Context.run({ requestId: 'inner' }, () => {
        innerInstance = Container.get(MyService);
      });
    });

    expect(outerInstance).not.toBe(innerInstance);
  });
});
