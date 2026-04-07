import type { Guard } from '@croco/framework-context';
import type { GraphQLCallHandler, GraphQLInterceptor, GraphQLInterceptorContext } from '../types/InterceptorTypes';

export class GuardInterceptor implements GraphQLInterceptor {
  private readonly guards: Guard<GraphQLInterceptorContext>[];

  constructor(guards: Guard<GraphQLInterceptorContext>[]) {
    this.guards = guards;
  }

  async intercept(context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown> {
    for (const guard of this.guards) {
      const canActivate = await guard.canActivate(context);
      if (!canActivate) {
        throw new Error('GUARD_DENIED');
      }
    }

    return next.handle();
  }
}
