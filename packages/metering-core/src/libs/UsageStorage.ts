import type { UsageQueryOptions, UsageRecord } from './types';

export type AtomicQuotaCheckOptions = {
  tenantId: string;
  meterId: string;
  value: number;
  quota: number;
  allowOverQuota: boolean;
  usageRecord: UsageRecord;
};

export type AtomicQuotaCheckResult = {
  exceeded: boolean;
  newUsage: number;
};

/**
 * Redis 기반 실시간 Usage 저장소 인터페이스
 *
 * @description
 * 구현체: RedisUsageStorage (이 패키지 내) 또는 사용자 커스텀
 * 모든 메서드는 tenant 격리를 보장해야 함
 */
export interface UsageStorage {
  /**
   * Usage 기록 (즉시 flush)
   * Redis Sorted Set에 저장
   */
  record(usage: UsageRecord): Promise<void>;

  /**
   * Usage 조회 (특정 기간 합산)
   */
  getUsage(options: UsageQueryOptions): Promise<number>;

  /**
   * Idempotency 체크 (SET NX 기반)
   * @returns true: 새 키 (기록 가능), false: 중복 (기록 불가)
   */
  isIdempotent(tenantId: string, meterId: string, idempotencyKey: string, ttlSeconds: number): Promise<boolean>;

  /**
   * Usage 데이터 조회 (배치 저장용)
   * Redis에서 특정 기간의 usage records 조회
   */
  fetchUsageRecords(options: UsageQueryOptions): Promise<UsageRecord[]>;

  checkAndRecordWithinQuota?(options: AtomicQuotaCheckOptions): Promise<AtomicQuotaCheckResult>;
}
