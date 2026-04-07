import type { GraphQLGuard, GraphQLGuardContext } from '../types/GuardTypes';

export class GuardChain {
  private readonly guards: GraphQLGuard[];

  constructor(guards: GraphQLGuard[]) {
    this.guards = guards;
  }

  async canActivate(context: GraphQLGuardContext): Promise<boolean> {
    for (const guard of this.guards) {
      const canActivate = await guard.canActivate(context);
      if (!canActivate) {
        return false;
      }
    }
    return true;
  }

  static async execute(guards: GraphQLGuard[], context: GraphQLGuardContext): Promise<boolean> {
    const chain = new GuardChain(guards);
    return chain.canActivate(context);
  }
}
