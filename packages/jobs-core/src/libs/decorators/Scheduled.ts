import { MetadataStorage } from '@croco/framework-context';
import type { CronExpression } from '../CronExpression';
import type { ScheduleOptions } from '../types';

export const SCHEDULE_METADATA_KEY = Symbol('SCHEDULE_METADATA');

export type ScheduleMetadata = {
  cron: string;
  methodName: string | symbol;
  options?: ScheduleOptions;
  target: object;
};

/**
 * Scheduled decorator for methods.
 *
 * @example
 * ```typescript
 * class ReportService {
 *   @Scheduled(CronExpression.EVERY_DAY_AT_MIDNIGHT, { name: 'daily-report' })
 *   async generateDailyReport() {
 *     // 매일 자정에 실행
 *   }
 * }
 * ```
 */
export function Scheduled(cron: string | CronExpression, options?: ScheduleOptions): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor => {
    const metadata: ScheduleMetadata = {
      cron: typeof cron === 'string' ? cron : cron,
      methodName: propertyKey,
      options,
      target,
    };
    MetadataStorage.define(SCHEDULE_METADATA_KEY, target, metadata, propertyKey);
    return descriptor;
  };
}
