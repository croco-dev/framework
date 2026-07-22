import "reflect-metadata";
import { Container } from "../Container";
import { OnShutdownDecoratorProblem } from "../problems/ShutdownProblems";
import { ShutdownManager } from "../ShutdownManager";
import type { Constructor, ShutdownHook } from "../types";

const ON_SHUTDOWN_METHOD_KEY = Symbol.for("@croco/framework-context/on-shutdown/method");
const ON_SHUTDOWN_REGISTRATIONS_KEY = Symbol.for(
  "@croco/framework-context/on-shutdown/registrations",
);

type ShutdownMethod = (this: unknown, signal?: AbortSignal) => unknown;

type ShutdownMethodDeclaration = {
  readonly propertyKey: string | symbol;
  readonly method: ShutdownMethod;
};

function applyMethodDecorator(
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
): void {
  if (typeof target === "function") {
    throw new OnShutdownDecoratorProblem("static-method", target.name, propertyKey);
  }

  const owningConstructor = target.constructor;
  if (typeof owningConstructor !== "function" || typeof descriptor.value !== "function") {
    throw new OnShutdownDecoratorProblem(
      "non-method",
      owningConstructor?.name ?? "<unknown>",
      propertyKey,
    );
  }

  const method = descriptor.value as ShutdownMethod;
  const existingDeclaration = Reflect.getOwnMetadata(ON_SHUTDOWN_METHOD_KEY, owningConstructor) as
    | ShutdownMethodDeclaration
    | undefined;

  if (existingDeclaration) {
    if (existingDeclaration.propertyKey === propertyKey && existingDeclaration.method === method) {
      registerConstructor(owningConstructor as Constructor);
      return;
    }

    throw new OnShutdownDecoratorProblem(
      "multiple-methods",
      owningConstructor.name,
      propertyKey,
      existingDeclaration.propertyKey,
    );
  }

  Reflect.defineMetadata(
    ON_SHUTDOWN_METHOD_KEY,
    { propertyKey, method } satisfies ShutdownMethodDeclaration,
    owningConstructor,
  );
  registerConstructor(owningConstructor as Constructor);
}

function applyClassDecorator(target: object): void {
  if (typeof target !== "function") {
    throw new OnShutdownDecoratorProblem("non-method", target.constructor?.name ?? "<unknown>");
  }

  registerConstructor(target as Constructor);
}

function registerConstructor(target: Constructor): void {
  const manager = ShutdownManager.getInstance();
  const registrations = getRegistrations(manager);

  if (registrations.has(target)) {
    return;
  }

  const hook: ShutdownHook = {
    onShutdown: async (signal?: AbortSignal): Promise<void> => {
      const instance = Container.get(target);
      const declaration = Reflect.getMetadata(ON_SHUTDOWN_METHOD_KEY, target) as
        | ShutdownMethodDeclaration
        | undefined;

      if (declaration) {
        await declaration.method.call(instance, signal);
        return;
      }

      const classHook = (instance as Partial<ShutdownHook>).onShutdown;
      if (typeof classHook === "function") {
        await classHook.call(instance, signal);
      }
    },
  };

  manager.register(hook);
  registrations.add(target);
}

function getRegistrations(manager: ShutdownManager): WeakSet<Constructor> {
  const existingRegistrations = Reflect.getOwnMetadata(ON_SHUTDOWN_REGISTRATIONS_KEY, manager) as
    | WeakSet<Constructor>
    | undefined;

  if (existingRegistrations) {
    return existingRegistrations;
  }

  const registrations = new WeakSet<Constructor>();
  Reflect.defineMetadata(ON_SHUTDOWN_REGISTRATIONS_KEY, registrations, manager);
  return registrations;
}

/**
 * 클래스 또는 인스턴스 메서드에 애플리케이션 종료 훅을 연결하는 데코레이터입니다.
 *
 * 클래스와 메서드에 함께 적용하면 메서드 선언이 우선하며 생성자당 하나의 훅만 등록됩니다.
 * 클래스에 상속된 메서드 선언은 가장 가까운 데코레이터 선언의 함수를 사용합니다.
 */
export function OnShutdown(): MethodDecorator & ClassDecorator {
  return (target: object, propertyKey?: string | symbol, descriptor?: PropertyDescriptor): void => {
    if (propertyKey !== undefined && descriptor !== undefined) {
      applyMethodDecorator(target, propertyKey, descriptor);
      return;
    }

    if (propertyKey !== undefined || descriptor !== undefined) {
      throw new OnShutdownDecoratorProblem(
        "non-method",
        typeof target === "function" ? target.name : (target.constructor?.name ?? "<unknown>"),
        propertyKey,
      );
    }

    applyClassDecorator(target);
  };
}
