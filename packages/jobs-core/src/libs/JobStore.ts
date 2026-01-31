import type { JobDispatchOptions, JobReference, JobStatus, ScheduleOptions, ScheduleReference } from './types';

/**
 * Abstract storage interface for job management.
 * Implementations: InMemoryJobStore, QStashJobStore
 */
export interface JobStore {
  /**
   * 작업을 디스패치합니다.
   * @param jobName 작업 이름
   * @param payload 작업 데이터
   * @param options 디스패치 옵션 (delay, notBefore 등)
   * @returns 작업 참조
   */
  dispatch<T>(jobName: string, payload: T, options?: JobDispatchOptions): Promise<JobReference>;

  /**
   * 작업 상태를 조회합니다.
   * @param jobId 작업 ID
   * @returns 작업 상태
   */
  getStatus(jobId: string): Promise<JobStatus>;

  /**
   * 작업을 취소합니다.
   * @param jobId 작업 ID
   * @returns 취소 성공 여부
   */
  cancel(jobId: string): Promise<boolean>;

  /**
   * 반복 스케줄을 등록합니다.
   * @param jobName 작업 이름
   * @param cron cron 표현식
   * @param options 스케줄 옵션
   * @returns 스케줄 참조
   */
  schedule(jobName: string, cron: string, options?: ScheduleOptions): Promise<ScheduleReference>;

  /**
   * 스케줄을 해제합니다.
   * @param scheduleId 스케줄 ID
   * @returns 해제 성공 여부
   */
  unschedule(scheduleId: string): Promise<boolean>;
}
