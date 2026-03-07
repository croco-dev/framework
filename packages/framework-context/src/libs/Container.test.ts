import { beforeEach, describe, expect, it } from 'vitest';
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

  it('should fail fast when request-scoped service is resolved outside Context', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    expect(() => Container.get(MyService)).toThrow(
      'Request-scoped dependencies must be resolved inside Context.run().'
    );
  });

  it('should continue returning the same instance within Context.run() for request-scoped services', () => {
    class MyService {
      public value = Math.random();
    }

    Component({ scope: 'request' })(MyService);

    let instance1!: MyService;
    let instance2!: MyService;

    Context.run({ requestId: 'req-outside-guard' }, () => {
      instance1 = Container.get(MyService);
      instance2 = Container.get(MyService);
    });

    expect(instance1).toBe(instance2);
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
