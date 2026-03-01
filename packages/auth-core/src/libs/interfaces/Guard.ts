import type { AuthRequest } from './AuthRequest';

export type RouteExecutionContext = {
  getClass(): unknown;
  getHandler(): string | symbol;
  getRequest(): AuthRequest;
};

export interface Guard<TContext = unknown> {
  canActivate(context: TContext): boolean | Promise<boolean>;
}
