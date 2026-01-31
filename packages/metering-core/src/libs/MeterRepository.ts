import type { MeterDefinition, MeterRegistrationOptions, UsageRecord } from './types';

/**
 * Meter 정의 및 Usage 데이터를 DB에 저장하는 인터페이스
 *
 * @description
 * 구현체는 사용자가 제공 (예: Drizzle, Prisma 등)
 * metering-core는 이 인터페이스만 의존
 */
export interface MeterRepository {
  /**
   * Meter 정의 조회 (tenantId + meterId로 검색)
   */
  findByMeterIdAndTenant(meterId: string, tenantId: string): Promise<MeterDefinition | null>;

  /**
   * Meter 정의 등록 (정적 + 동적 모두 사용)
   */
  save(meter: MeterRegistrationOptions): Promise<MeterDefinition>;

  /**
   * 앱 시작 시 모든 meter 로딩
   */
  findAll(): Promise<MeterDefinition[]>;

  /**
   * 테넌트별 meter 조회
   */
  findByTenant(tenantId: string): Promise<MeterDefinition[]>;

  /**
   * 배치 저장용 - Usage 레코드들을 DB에 영구 저장
   */
  saveUsageRecords(records: UsageRecord[]): Promise<void>;
}
