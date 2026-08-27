import { resolveImpersonationContext } from "@croco/audit-core";
import { Context } from "@croco/framework-context";
import { BlockedDuringImpersonationProblem } from "../problems/ImpersonationProblems";

type MethodDecorator = (
  target: object,
  propertyKey: string | symbol,
  descriptor: PropertyDescriptor,
) => PropertyDescriptor | undefined;

export function BlockDuringImpersonation(): MethodDecorator {
  return (
    _target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value;
    descriptor.value = async function (...args: unknown[]) {
      const context = Context.get();
      if (resolveImpersonationContext(context).status !== "absent") {
        throw new BlockedDuringImpersonationProblem(String(propertyKey));
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}
