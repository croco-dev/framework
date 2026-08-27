import { resolveImpersonationContext } from "@croco/audit-core";
import { Context } from "@croco/framework-context";
import { resolveImpersonationConfig } from "../ImpersonationConfig";
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
      const impersonation = resolveImpersonationContext(context);
      if (impersonation.status !== "absent") {
        const action = String(propertyKey);
        if (
          impersonation.status === "invalid" ||
          resolveImpersonationConfig().blockedActions.includes(action)
        ) {
          throw new BlockedDuringImpersonationProblem(action);
        }
      }
      return original.apply(this, args);
    };
    return descriptor;
  };
}
