import "reflect-metadata";
import type { AuthRequest, AuthUser } from "@croco/auth-core";
import type { Guard } from "@croco/framework-context";
import { Container, Context } from "@croco/framework-context";
import { recordEvent } from "@croco/telemetry-api";
import type { EntitlementManager } from "./EntitlementManager";
import type { EntitlementRequirement } from "./EntitlementRequirement";
import { getEntitlementRequirements } from "./EntitlementRequirement";
import type { EntitlementGuardAuditEvent } from "./interfaces";
import { EntitlementAuditSink } from "./interfaces";
import {
  EntitlementDeniedProblem,
  EntitlementInactiveSubscriptionProblem,
  EntitlementMissingPlanProblem,
  EntitlementProviderUnavailableProblem,
  EntitlementQuotaExceededProblem,
} from "./problems/EntitlementProblems";
import type { EntitlementCheckResult } from "./types";

export type RouteExecutionContext = {
  getClass(): unknown;
  getHandler(): string | symbol;
  getRequest(): AuthRequest & { tenantId?: string };
  getHttpContext?(): {
    req: {
      params: Record<string, string>;
    };
    param(name: string): string | undefined;
    get<T>(key: string): T | undefined;
  } | null;
};

type EntitlementAuthUser = AuthUser & { tenantId?: string };

export type EntitlementGuardSubject = {
  readonly type: "user";
  readonly id: string;
};

export type EntitlementGuardResource = {
  readonly type: string;
  readonly id: string;
};

export type EntitlementGuardRoute = {
  readonly controllerName: string;
  readonly handlerName: string;
  readonly routeId: string;
};

export type EntitlementGuardInput = {
  readonly requirement: EntitlementRequirement;
  readonly tenantId: string;
  readonly subject?: EntitlementGuardSubject;
  readonly resource?: EntitlementGuardResource;
  readonly route: EntitlementGuardRoute;
};

export class EntitlementGuard implements Guard<RouteExecutionContext> {
  constructor(private readonly entitlementManager: EntitlementManager) {}

  async canActivate(context: RouteExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();
    const requirements = getEntitlementRequirements(target, handler);

    if (requirements.length === 0) {
      return true;
    }

    for (const requirement of requirements) {
      const input = this.createGuardInput(context, requirement);
      let result: EntitlementCheckResult;

      try {
        result = await this.entitlementManager.check(input.tenantId, input.requirement.feature);
      } catch (error) {
        const problem = new EntitlementProviderUnavailableProblem(
          input.requirement.feature,
          error instanceof Error ? error : undefined,
        );
        await this.recordDenied(input, "unknown", "provider_unavailable", problem.code);
        throw problem;
      }

      const problem = toEntitlementProblem(input, result);

      if (problem) {
        await this.recordDenied(
          input,
          result.status,
          result.reason ?? "not_entitled",
          problem.code,
        );
        throw problem;
      }

      await this.recordAllowed(input, result);
    }

    return true;
  }

  private createGuardInput(
    context: RouteExecutionContext,
    requirement: EntitlementRequirement,
  ): EntitlementGuardInput {
    const request = context.getRequest();
    const user = request.user as EntitlementAuthUser | undefined;
    const tenantId = this.resolveTenantId(context, request, user);

    if (!tenantId) {
      throw new EntitlementDeniedProblem(requirement.feature, "tenantId not found in request");
    }

    return {
      requirement,
      tenantId,
      ...(user?.id ? { subject: { type: "user", id: user.id } } : {}),
      ...this.resolveResource(context, request, requirement),
      route: this.resolveRoute(context),
    };
  }

  private resolveTenantId(
    context: RouteExecutionContext,
    request: AuthRequest & { tenantId?: string },
    user: EntitlementAuthUser | undefined,
  ): string | null {
    if (typeof request.tenantId === "string" && request.tenantId.length > 0) {
      return request.tenantId;
    }

    if (typeof user?.tenantId === "string" && user.tenantId.length > 0) {
      return user.tenantId;
    }

    const httpContextTenantId = context.getHttpContext?.()?.get<string>("tenantId");
    if (typeof httpContextTenantId === "string" && httpContextTenantId.length > 0) {
      return httpContextTenantId;
    }

    const currentTenantId = Context.getTenantId();
    if (typeof currentTenantId === "string" && currentTenantId.length > 0) {
      return currentTenantId;
    }

    return null;
  }

  private resolveResource(
    context: RouteExecutionContext,
    request: AuthRequest,
    requirement: EntitlementRequirement,
  ): Pick<EntitlementGuardInput, "resource"> {
    const resource = requirement.resource;

    if (!resource) {
      return {};
    }

    const id = resource.id ?? this.resolveResourceId(context, request, resource.idParam);

    if (!id) {
      throw new EntitlementDeniedProblem(requirement.feature, "resource id not found in request");
    }

    return {
      resource: {
        type: resource.type,
        id,
      },
    };
  }

  private resolveResourceId(
    context: RouteExecutionContext,
    request: AuthRequest,
    idParam: string | undefined,
  ): string | null {
    if (!idParam) {
      return null;
    }

    const params = (request as { readonly params?: Record<string, string> }).params;
    const requestParam = params?.[idParam];
    if (typeof requestParam === "string" && requestParam.length > 0) {
      return requestParam;
    }

    const httpContext = context.getHttpContext?.();
    const contextParam = httpContext?.param(idParam) ?? httpContext?.req.params[idParam];

    return typeof contextParam === "string" && contextParam.length > 0 ? contextParam : null;
  }

  private resolveRoute(context: RouteExecutionContext): EntitlementGuardRoute {
    const target = context.getClass();
    const handler = context.getHandler();
    const controllerName =
      typeof target === "function"
        ? target.name
        : target && typeof target === "object" && target.constructor.name.length > 0
          ? target.constructor.name
          : "anonymous";
    const handlerName = String(handler);

    return {
      controllerName,
      handlerName,
      routeId: `${controllerName}.${handlerName}`,
    };
  }

  private async recordAllowed(
    input: EntitlementGuardInput,
    result: EntitlementCheckResult,
  ): Promise<void> {
    recordEvent("entitlement.guard.allowed", toTelemetryAttributes(input, result.status));
    await this.recordAuditEvent({
      type: "entitlement.guard.allowed",
      tenantId: input.tenantId,
      feature: input.requirement.feature,
      status: result.status,
      ...(input.subject ? { userId: input.subject.id } : {}),
      ...(input.resource ? { resource: input.resource } : {}),
      route: input.route,
      metadata: {
        planId: result.planId,
        overagePolicy: result.overagePolicy,
      },
    });
  }

  private async recordDenied(
    input: EntitlementGuardInput,
    status: EntitlementCheckResult["status"],
    reason: string,
    problemCode: string,
  ): Promise<void> {
    recordEvent(
      "entitlement.guard.denied",
      toTelemetryAttributes(input, status, reason, problemCode),
    );
    await this.recordAuditEvent({
      type: "entitlement.guard.denied",
      tenantId: input.tenantId,
      feature: input.requirement.feature,
      status,
      ...(input.subject ? { userId: input.subject.id } : {}),
      ...(input.resource ? { resource: input.resource } : {}),
      route: input.route,
      reason,
      problemCode,
    });
  }

  private async recordAuditEvent(event: EntitlementGuardAuditEvent): Promise<void> {
    const auditSink = Container.getOptional(EntitlementAuditSink.token);

    if (!auditSink) {
      return;
    }

    try {
      await auditSink.recordEntitlementGuard(event);
    } catch {
      recordEvent("entitlement.guard.audit_failed", {
        "entitlement.feature": event.feature,
        "entitlement.status": event.status,
        "tenant.id": event.tenantId,
        "route.id": event.route?.routeId ?? "unknown",
        "audit.event": event.type,
      });
    }
  }
}

function toEntitlementProblem(
  input: EntitlementGuardInput,
  result: EntitlementCheckResult,
):
  | EntitlementDeniedProblem
  | EntitlementInactiveSubscriptionProblem
  | EntitlementMissingPlanProblem
  | EntitlementQuotaExceededProblem
  | EntitlementProviderUnavailableProblem
  | null {
  if (result.granted) {
    return null;
  }

  switch (result.reason) {
    case "no_subscription":
      return new EntitlementMissingPlanProblem(input.requirement.feature, input.tenantId);
    case "inactive_subscription":
      return new EntitlementInactiveSubscriptionProblem(input.requirement.feature, input.tenantId);
    case "quota_exceeded":
      return new EntitlementQuotaExceededProblem(
        input.requirement.feature,
        result.usage,
        result.quota,
      );
    case "provider_unavailable":
      return new EntitlementProviderUnavailableProblem(input.requirement.feature);
    default:
      return new EntitlementDeniedProblem(input.requirement.feature, result.reason);
  }
}

function toTelemetryAttributes(
  input: EntitlementGuardInput,
  status: EntitlementCheckResult["status"],
  reason?: string,
  problemCode?: string,
): Record<string, string | number | boolean> {
  return {
    "entitlement.feature": input.requirement.feature,
    "entitlement.status": status,
    "tenant.id": input.tenantId,
    "route.id": input.route.routeId,
    ...(input.subject ? { "user.id": input.subject.id } : {}),
    ...(input.resource
      ? {
          "resource.type": input.resource.type,
          "resource.id": input.resource.id,
        }
      : {}),
    ...(reason ? { "entitlement.reason": reason } : {}),
    ...(problemCode ? { "problem.code": problemCode } : {}),
  };
}
