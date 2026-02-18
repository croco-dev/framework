import { beforeEach, describe, expect, it } from 'vitest';
import 'reflect-metadata';
import { Container, MetadataStorage } from '../index';

describe('Container.validate', () => {
  beforeEach(() => {
    Container.reset();
    MetadataStorage.clear();
  });

  it('should throw with full cycle path when circular dependency exists', () => {
    class ServiceA {
      constructor(_b: ServiceB) {}
    }

    class ServiceB {
      constructor(_c: ServiceC) {}
    }

    class ServiceC {
      constructor(_a: ServiceA) {}
    }

    Reflect.defineMetadata('design:paramtypes', [ServiceB], ServiceA);
    Reflect.defineMetadata('design:paramtypes', [ServiceC], ServiceB);
    Reflect.defineMetadata('design:paramtypes', [ServiceA], ServiceC);

    Container.register(ServiceA, 'transient');
    Container.register(ServiceB, 'transient');
    Container.register(ServiceC, 'transient');

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: ServiceA → ServiceB → ServiceC → ServiceA/);
  });

  it('should not throw when no circular dependency exists', () => {
    class ServiceA {}

    class ServiceB {
      constructor(_a: ServiceA) {}
    }

    class ServiceC {
      constructor(_b: ServiceB) {}
    }

    Reflect.defineMetadata('design:paramtypes', [], ServiceA);
    Reflect.defineMetadata('design:paramtypes', [ServiceA], ServiceB);
    Reflect.defineMetadata('design:paramtypes', [ServiceB], ServiceC);

    Container.register(ServiceA, 'singleton');
    Container.register(ServiceB, 'singleton');
    Container.register(ServiceC, 'singleton');

    expect(() => {
      Container.validate();
    }).not.toThrow();
  });

  it('should detect self-referencing dependency', () => {
    class SelfReferencing {
      constructor(_self: SelfReferencing) {}
    }

    Reflect.defineMetadata('design:paramtypes', [SelfReferencing], SelfReferencing);
    Container.register(SelfReferencing, 'transient');

    expect(() => {
      Container.validate();
    }).toThrowError(/Circular dependency detected: SelfReferencing → SelfReferencing/);
  });
});
