export type AuditExecutionContext = {
  getRequest(): Request;
  getClass(): {
    name?: string;
  };
  getHandler(): string | symbol;
  getPath(): string;
  getMethod(): string;
};

export interface CallHandler {
  handle(): Promise<unknown>;
}

export interface Interceptor<TContext = unknown, THandler = CallHandler> {
  intercept(context: TContext, next: THandler): Promise<unknown>;
}
