import type { CallHandler } from "./CallHandler";

export interface Interceptor<TContext = unknown> {
  intercept(context: TContext, next: CallHandler): Promise<unknown>;
}
