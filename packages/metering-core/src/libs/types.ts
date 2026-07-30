/**
 * Meter 유형
 * - COUNT: 단순 횟수 카운트 (API 호출)
 * - UNIQUE_COUNT: 고유 값 카운트 (MAU/DAU)
 * - CUSTOM_EVENT: 사용자 정의 이벤트
 */
export type MeterType = "COUNT" | "UNIQUE_COUNT" | "CUSTOM_EVENT";

/**
 * 집계 기간
 */
export type AggregationPeriod = "hour" | "day" | "billing_cycle";

/**
 * Meter 정의 (DB 저장)
 */
export type MeterDefinition = {
  id: string;
  tenantId: string;
  meterId: string;
  type: MeterType;
  billing?: "local" | "required";
  aggregation?: MeterAggregation;
  unit?: string;
  quota?: number;
  allowOverQuota?: boolean;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 사용량 기록
 */
export type UsageRecord = {
  id: string;
  tenantId: string;
  meterId: string;
  /** Usage amount from 1 through 2_147_483_647, supported by every storage adapter. */
  value: number;
  timestamp: Date;
  idempotencyKey: string;
  eventId?: string;
  dimensions?: Record<string, string | number | boolean>;
  metadata?: Record<string, unknown>;
};

/**
 * record() 메서드의 호환성 옵션
 *
 * @description 새 코드에서는 `defineMeter()`와 typed `record(meter, input)` 경로를 권장합니다.
 */
export type RecordOptions = {
  tenantId: string;
  meterId: string;
  /** Optional usage amount from 1 through 2_147_483_647. Defaults to 1. */
  value?: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
};

/**
 * Usage 조회 옵션
 */
export type UsageQueryOptions = {
  tenantId: string;
  meterId: string;
  period: AggregationPeriod;
  /** Inclusive lower timestamp bound. Must be provided together with endDate. */
  startDate?: Date;
  /** Inclusive upper timestamp bound. Must be provided together with startDate. */
  endDate?: Date;
};

/**
 * Meter 등록 옵션 (DB 저장 전)
 */
export type MeterRegistrationOptions = Omit<MeterDefinition, "id" | "createdAt" | "updatedAt">;

/**
 * 배치 저장 결과
 */
export type FlushResult = {
  recordsFlushed: number;
};
import type { MeterAggregation } from "./MeterRef";
