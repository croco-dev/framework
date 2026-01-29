import type { CallHandler } from '../interfaces/CallHandler';
import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { Interceptor } from '../interfaces/Interceptor';

export class LoggingInterceptor implements Interceptor<ExecutionContext> {
  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const method = context.getMethod();
    const path = context.getPath();
    const startTime = performance.now();

    const result = await next.handle();

    const duration = Math.round(performance.now() - startTime);
    console.log(`[HTTP] ${method} ${path} - ${duration} ms`);

    return result;
  }
}
