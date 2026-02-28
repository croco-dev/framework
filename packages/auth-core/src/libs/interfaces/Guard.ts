export type RouteExecutionContext = {
  getClass(): unknown;
  getHandler(): string | symbol;
  getRequest(): Request;
};

export interface Guard<TContext = unknown> {
  canActivate(context: TContext): boolean | Promise<boolean>;
}
