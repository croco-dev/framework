import { triggerRegistry } from '../TriggerRegistry';
import type { CronOptions, CronTriggerMetadata } from '../types';

export const CRON_METADATA_KEY = Symbol('CRON_METADATA');

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
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const metadata: CronTriggerMetadata = {
      type: 'cron',
      expression,
      methodName: propertyKey,
      options,
      target,
    };

    triggerRegistry.register(metadata);

    return descriptor;
  };
}
