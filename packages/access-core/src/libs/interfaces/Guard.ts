export type AccessHttpContext = {
  req: {
    params: Record<string, string>;
  };
  param(name: string): string | undefined;
  get<T>(key: string): T | undefined;
};

export type AccessExecutionContext = {
  getClass(): object;
  getHandler(): string | symbol;
  getRequest(): Request;
  getHttpContext?(): AccessHttpContext;
};

export interface Guard<TContext = unknown> {
  canActivate(context: TContext): boolean | Promise<boolean>;
}
