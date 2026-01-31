import { MetadataStorage } from '@croco/framework-context';
import { SCHEDULE_METADATA_KEY, type ScheduleMetadata } from './decorators/Scheduled';
import type { JobStore } from './JobStore';
import type { JobDispatchOptions, JobReference, ScheduleReference } from './types';

export class JobDispatcher {
  constructor(private readonly store: JobStore) {}

  /**
   * 작업을 디스패치합니다.
   */
  async dispatch<T>(jobName: string, payload: T, options?: JobDispatchOptions): Promise<JobReference> {
    return this.store.dispatch(jobName, payload, options);
  }

  /**
   * @Scheduled 데코레이터가 적용된 모든 메서드를 스케줄에 등록합니다.
   */
  async scheduleAll(): Promise<ScheduleReference[]> {
    const schedules = MetadataStorage.getAll<ScheduleMetadata>(SCHEDULE_METADATA_KEY);
    const results: ScheduleReference[] = [];

    for (const { value: schedule } of schedules) {
      if (schedule.options?.disabled) {
        continue;
      }

      const jobName = schedule.options?.name ?? String(schedule.methodName);
      const result = await this.store.schedule(jobName, schedule.cron, {
        timeZone: schedule.options?.timeZone,
      });
      results.push(result);
    }

    return results;
  }

  /**
   * 특정 스케줄을 해제합니다.
   */
  async unschedule(scheduleId: string): Promise<boolean> {
    return this.store.unschedule(scheduleId);
  }
}
