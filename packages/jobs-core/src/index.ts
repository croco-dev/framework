// @croco/jobs-core
// Job scheduling and execution for croco framework

export type { JobHandler, JobMetadata } from './libs/decorators/Job';
// Decorator
export { JOB_METADATA_KEY, Job } from './libs/decorators/Job';
export type { ScheduleMetadata } from './libs/decorators/Scheduled';
export { SCHEDULE_METADATA_KEY, Scheduled } from './libs/decorators/Scheduled';
// Store
export { InMemoryJobStore } from './libs/InMemoryJobStore';
// Core
export { JobDispatcher } from './libs/JobDispatcher';
// Registry
export { JobRegistry } from './libs/JobRegistry';
export type { JobStore } from './libs/JobStore';
// Types
export type {
  Duration,
  JobDispatchOptions,
  JobOptions,
  JobReference,
  JobStatus,
  ScheduleOptions,
  ScheduleReference,
} from './libs/types';
export { JobState, parseDuration } from './libs/types';
