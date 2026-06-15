import type { ILogger } from "@croco/framework-context";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { CallHandler } from "../interfaces/CallHandler";
import type { ExecutionContext } from "../interfaces/ExecutionContext";
import type { Interceptor } from "../interfaces/Interceptor";

/**
 * 요청 처리 시간과 경로 정보를 로깅하는 기본 Interceptor입니다.
 */
export class LoggingInterceptor implements Interceptor<ExecutionContext> {
  private readonly logger: ILogger;

  constructor(logger: ILogger = Container.get(LOGGER_TOKEN)) {
    this.logger = logger;
  }

  async intercept(context: ExecutionContext, next: CallHandler): Promise<unknown> {
    const method = context.getMethod();
    const path = context.getPath();
    const startTime = performance.now();

    const result = await next.handle();

    const durationMs = Math.round(performance.now() - startTime);
    this.logger.info("HTTP request completed", {
      method,
      path,
      durationMs,
    });

    return result;
  }
}
