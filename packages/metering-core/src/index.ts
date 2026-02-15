// Core Services

export type { MeterMetadata, MeterOptions } from './libs/decorators/Meter';
// Decorators
export { getMeterMetadata, hasMeterMetadata, METER_METADATA_KEY, Meter } from './libs/decorators/Meter';
export type { MeteredMetadata, MeteredOptions } from './libs/decorators/Metered';
export {
  getMeteredMetadata,
  getMeteringService,
  METERED_METADATA_KEY,
  Metered,
  setMeteringService,
} from './libs/decorators/Metered';
export { QuotaExceededEvent } from './libs/events/QuotaExceededEvent';
// Events
export { UsageRecordedEvent } from './libs/events/UsageRecordedEvent';
export { IdempotencyManager } from './libs/IdempotencyManager';
export type { MeteringServiceOptions } from './libs/MeteringService';
export { MeteringService } from './libs/MeteringService';
export { MeterRegistry } from './libs/MeterRegistry';
// Interfaces (for custom implementations)
export type { MeterRepository } from './libs/MeterRepository';
export { DuplicateRecordProblem } from './libs/problems/DuplicateRecordProblem';
export { InvalidMeterProblem } from './libs/problems/InvalidMeterProblem';
// Problems
export { QuotaExceededProblem } from './libs/problems/QuotaExceededProblem';
export { RedisProblem } from './libs/problems/RedisProblem';
export type {
  QuotaCheckAndRecordOptions,
  QuotaCheckAndRecordResult,
  QuotaManagerOptions,
} from './libs/QuotaManager';
export { QuotaManager } from './libs/QuotaManager';
export type { RedisClient } from './libs/RedisClient';
export { RedisUsageStorage } from './libs/RedisUsageStorage';
// Types (always last)
export type {
  AggregationPeriod,
  FlushResult,
  MeterDefinition,
  MeterRegistrationOptions,
  MeterType,
  RecordOptions,
  UsageQueryOptions,
  UsageRecord,
} from './libs/types';
export type { UsageAggregatorOptions } from './libs/UsageAggregator';
export { UsageAggregator } from './libs/UsageAggregator';
export type { AtomicQuotaCheckOptions, AtomicQuotaCheckResult, UsageStorage } from './libs/UsageStorage';
