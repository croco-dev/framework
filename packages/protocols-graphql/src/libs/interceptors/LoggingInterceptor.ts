import type { ILogger } from "@croco/framework-context";
import { Inject, LOGGER_TOKEN } from "@croco/framework-context";
import type {
  GraphQLCallHandler,
  GraphQLInterceptor,
  GraphQLInterceptorContext,
} from "../types/InterceptorTypes";

export class LoggingInterceptor implements GraphQLInterceptor {
  constructor(@Inject(LOGGER_TOKEN) private readonly logger: ILogger) {}

  async intercept(context: GraphQLInterceptorContext, next: GraphQLCallHandler): Promise<unknown> {
    const operationName =
      (context.info.operation?.name as { name?: string } | undefined)?.name ?? "anonymous";
    const fieldName = context.info.fieldName;
    const startTime = performance.now();

    const result = await next.handle();

    const durationMs = Math.round(performance.now() - startTime);
    this.logger.info("GraphQL resolver completed", {
      operation: operationName,
      field: fieldName,
      durationMs,
    });

    return result;
  }
}
