import { MetadataStorage } from "@croco/framework-context";
import { CRON_METADATA_KEY } from "../metadataKeys";
import type { CronOptions, CronTriggerMetadata } from "../types";

export { CRON_METADATA_KEY } from "../metadataKeys";

/**
 * Cron decorator for scheduling periodic execution.
 *
 * @example
 * class ReportService {
 *   &#64;Cron('0 0 * * *', { name: 'daily-report' })
 *   async generateDailyReport() {
 *     // 매일 자정에 실행
 *   }
 *
 *   &#64;Cron('0/5 * * * *')  // 5분마다 실행
 *   async processQueue() {
 *     // 대기열 처리
 *   }
 * }
 */
export function Cron(expression: string, options: CronOptions = {}): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const metadata: CronTriggerMetadata = {
      type: "cron",
      expression,
      methodName: propertyKey,
      options,
      target,
    };

    MetadataStorage.define(CRON_METADATA_KEY, target, metadata, propertyKey);

    return descriptor;
  };
}
