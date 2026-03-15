import 'reflect-metadata';
import type { AuthRequest, AuthUser } from '@croco/auth-core';
import type { Guard } from '@croco/framework-context';
import { ENTITLEMENT_REQUIRED_KEY } from './decorators/RequireEntitlement';
import type { EntitlementManager } from './EntitlementManager';
import { EntitlementDeniedProblem } from './problems/EntitlementProblems';

export type RouteExecutionContext = {
  getClass(): unknown;
  getHandler(): string | symbol;
  getRequest(): AuthRequest & { tenantId?: string };
};

type EntitlementAuthUser = AuthUser & { tenantId?: string };

function getRequiredFeature(controllerTarget: unknown, handler: string | symbol): string | null {
  const classTarget =
    typeof controllerTarget === 'function' ? controllerTarget : (controllerTarget as object).constructor;
  const prototypeTarget = typeof controllerTarget === 'function' ? controllerTarget.prototype : controllerTarget;

  return (
    Reflect.getMetadata(ENTITLEMENT_REQUIRED_KEY, classTarget, handler) ??
    Reflect.getMetadata(ENTITLEMENT_REQUIRED_KEY, prototypeTarget, handler) ??
    Reflect.getMetadata(ENTITLEMENT_REQUIRED_KEY, classTarget) ??
    null
  );
}

function isMetadataTarget(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export class EntitlementGuard implements Guard<RouteExecutionContext> {
  constructor(private readonly entitlementManager: EntitlementManager) {}

  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    if (!isMetadataTarget(target)) {
      return true;
    }

    const featureKey = getRequiredFeature(target, handler);

    if (featureKey === null) {
      return true;
    }

    const request = context.getRequest();
    const user = request.user as EntitlementAuthUser | undefined;
    const tenantId = request.tenantId ?? user?.tenantId;

    if (!tenantId) {
      throw new EntitlementDeniedProblem(featureKey, 'tenantId not found in request');
    }

    const result = await this.entitlementManager.check(tenantId, featureKey);

    if (result.granted === false) {
      throw new EntitlementDeniedProblem(featureKey, result.reason);
    }

    return true;
  }
}
