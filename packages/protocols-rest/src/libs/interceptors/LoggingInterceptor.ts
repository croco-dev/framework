import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { CallHandler } from '../interfaces/CallHandler';
import type { ExecutionContext } from '../interfaces/ExecutionContext';
import type { Interceptor } from '../interfaces/Interceptor';

export class LoggingInterceptor implements Interceptor<ExecutionContext> {
  constructor(private readonly logger: Pick<Logger, 'info'> = Container.get(Logger)) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const method = context.getMethod();
    const path = context.getPath();
    const startTime = performance.now();

    const result = await next.handle();

    const durationMs = Math.round(performance.now() - startTime);
    this.logger.info('HTTP request completed', {
      method,
      path,
      durationMs,
    });

    return result;
  }
}
