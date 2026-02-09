import 'reflect-metadata';
import { Problem, ProblemCategory } from '@croco/problems-core';
import type { ExecutionContext, Guard } from '@croco/protocols-rest';
import type { AccessEngine } from '../AccessEngine';
import { ACCESS_METADATA_KEY } from '../constants';

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

export class AccessGuard implements Guard<ExecutionContext> {
  constructor(private accessEngine: AccessEngine) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const target = context.getClass();
    const handler = context.getHandler();

    const metadata = Reflect.getMetadata(ACCESS_METADATA_KEY, target, handler);

    if (!metadata) {
      return true;
    }

    // biome-ignore lint/suspicious/noExplicitAny: ExecutionContext Request type does not have user/tenantId/params properties
    const request = context.getRequest() as any;
    const user = request.user;
    const tenantId = request.tenantId;

    const objectId = request.params?.id || request.params?.[`${metadata.objectType}Id`];

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
}
