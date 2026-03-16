import 'reflect-metadata';
import { Context } from '@croco/framework-context';
import { Problem, ProblemCategory } from '@croco/problems-core';
import type { AccessEngine } from '../AccessEngine';
import { ACCESS_METADATA_KEY } from '../constants';
import type { AccessExecutionContext, Guard } from '../interfaces/Guard';

export class BadRequestProblem extends Problem {
  constructor(detail = 'Bad request') {
    super('BAD_REQUEST', ProblemCategory.BadRequest, detail);
  }
}

export class ForbiddenProblem extends Problem {
  constructor(detail = 'Forbidden') {
    super('FORBIDDEN', ProblemCategory.Forbidden, detail);
  }
}

export class AccessGuard implements Guard<AccessExecutionContext> {
  constructor(private accessEngine: AccessEngine) {}

  async canActivate(context: AccessExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    const metadata = Reflect.getMetadata(ACCESS_METADATA_KEY, target, handler);

    if (!metadata) {
      return true;
    }

    const request = context.getRequest() as RequestWithAccessData;
    const user = this.resolveUser(request);
    if (!user) {
      throw new BadRequestProblem('Authenticated user missing');
    }

    const tenantId = this.resolveTenantId(context, request);
    if (!tenantId) {
      throw new BadRequestProblem('Tenant ID missing');
    }

    const objectId = this.resolveObjectId(context, request, metadata.objectType);

    if (!objectId) {
      throw new BadRequestProblem('Object ID missing');
    }

    const object = `${metadata.objectType}:${objectId}`;

    const result = await this.accessEngine.check({
      tenantId,
      subject: `user:${user.id}`,
      relation: metadata.relation,
      object,
    });

    if (!result.allowed) {
      throw new ForbiddenProblem(`Access denied to ${object}`);
    }

    return true;
  }

  private resolveUser(request: RequestWithAccessData): { id: string } | null {
    const user = request.user;

    if (typeof user !== 'object' || user === null) {
      return null;
    }

    const userRecord = user as Record<string, unknown>;
    return typeof userRecord.id === 'string' ? ({ id: userRecord.id } as { id: string }) : null;
  }

  private resolveTenantId(context: AccessExecutionContext, request: RequestWithAccessData): string | null {
    if (typeof request.tenantId === 'string' && request.tenantId.length > 0) {
      return request.tenantId;
    }

    const httpContext = this.getHttpContext(context);
    if (httpContext) {
      const contextTenantId = httpContext.get<string>('tenantId');
      if (typeof contextTenantId === 'string' && contextTenantId.length > 0) {
        return contextTenantId;
      }
    }

    const currentTenantId = Context.getTenantId();
    if (typeof currentTenantId === 'string' && currentTenantId.length > 0) {
      return currentTenantId;
    }

    return null;
  }

  private resolveObjectId(
    context: AccessExecutionContext,
    request: RequestWithAccessData,
    objectType: string
  ): string | undefined {
    const params = request.params ?? this.getHttpContext(context)?.req.params;

    const objectTypeIdKey = `${objectType}Id`;
    const byParams = params?.id ?? params?.[objectTypeIdKey];
    if (typeof byParams === 'string' && byParams.length > 0) {
      return byParams;
    }

    const httpContext = this.getHttpContext(context);
    if (!httpContext) {
      return undefined;
    }

    return httpContext.param('id') ?? httpContext.param(objectTypeIdKey);
  }

  private getHttpContext(context: AccessExecutionContext): CrocoHttpContextLike | null {
    if (typeof context.getHttpContext !== 'function') {
      return null;
    }

    return context.getHttpContext();
  }
}

type RequestWithAccessData = Request & {
  user?: unknown;
  tenantId?: string;
  params?: Record<string, string>;
};

type CrocoHttpContextLike = {
  req: {
    params: Record<string, string>;
  };
  param(name: string): string | undefined;
  get<T>(key: string): T | undefined;
};
