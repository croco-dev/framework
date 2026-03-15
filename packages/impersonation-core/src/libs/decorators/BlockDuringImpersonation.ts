import { Context } from '@croco/framework-context';
import { BlockedDuringImpersonationProblem } from '../problems/ImpersonationProblems';
import type { ImpersonationContext } from '../types';

type MethodDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor
) => PropertyDescriptor | void;

export function BlockDuringImpersonation(): MethodDecorator {
  return (_target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const original = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const context = Context.get();
      if (context && 'impersonation' in context && (context as ImpersonationContext).impersonation) {
        throw new BlockedDuringImpersonationProblem(String(propertyKey));
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}
