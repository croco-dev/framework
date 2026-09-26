import { UsageFlushConfigurationProblem } from "./problems/UsageFlushConfigurationProblem";
import type { MeterRepository } from "./MeterRepository";
import type { AggregationPeriod, FlushResult, UsageQueryOptions } from "./types";
import type { UsageStorage } from "./UsageStorage";

export type UsageAggregatorOptions = {
  usageStorage: UsageStorage;
  meterRepository: MeterRepository;
};

/**
 * Usage 배치 집계 및 DB 저장
 *
 * @description
 * Redis의 실시간 Usage 데이터를 주기적으로 DB에 영구 저장합니다.
 * - Lambda 환경에서는 즉시 flush하므로 배치 집계는 선택적
 * - 장기 보관 및 분석을 위한 DB 저장
 * - 현재 UTC 청구 주기의 기록은 quota와 조회를 위해 Redis에 유지하고, 닫힌 주기만 저장 후 삭제
 */
export class UsageAggregator {
  private readonly usageStorage: UsageStorage;
  private readonly meterRepository: MeterRepository;

  constructor(options: UsageAggregatorOptions) {
    if (typeof options.usageStorage.deleteUsageRecords !== "function") {
      throw new UsageFlushConfigurationProblem("UsageStorage must implement deleteUsageRecords");
    }
    if (options.meterRepository.replayContract !== "idempotent") {
      throw new UsageFlushConfigurationProblem(
        "MeterRepository must declare an idempotent replayContract",
      );
    }
    this.usageStorage = options.usageStorage;
    this.meterRepository = options.meterRepository;
  }

  /**
   * Redis에서 Usage 레코드를 가져와 DB에 저장
   *
   * @param tenantId - 테넌트 ID
   * @param meterId - Meter ID
   * @param period - 집계 기간
   * @param range - 이전 청구 주기 등 저장할 기간의 양 끝 (포함)
   * @returns 저장된 레코드 수
   */
  async flushUsageToDB(
    tenantId: string,
    meterId: string,
    period: AggregationPeriod = "billing_cycle",
    range?: { startDate: Date; endDate: Date },
  ): Promise<FlushResult> {
    const deleteUsageRecords = this.usageStorage.deleteUsageRecords;
    if (typeof deleteUsageRecords !== "function") {
      throw new UsageFlushConfigurationProblem("UsageStorage must implement deleteUsageRecords");
    }
    const options: UsageQueryOptions = {
      tenantId,
      meterId,
      period,
      ...range,
    };

    // Redis에서 레코드 조회
    const records = await this.usageStorage.fetchUsageRecords(options);

    if (records.length === 0) {
      return { recordsFlushed: 0 };
    }

    // DB에 배치 저장
    await this.meterRepository.saveUsageRecords(records);

    const now = new Date();
    const currentBillingCycleStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1);
    const closedCycleRecords = records.filter(
      (record) => record.timestamp.getTime() < currentBillingCycleStart,
    );
    if (closedCycleRecords.length > 0) {
      await deleteUsageRecords.call(this.usageStorage, options, closedCycleRecords);
    }

    return { recordsFlushed: records.length };
  }

  /**
   * 테넌트의 모든 Meter에 대해 flush 수행
   */
  async flushAllForTenant(tenantId: string): Promise<FlushResult> {
    const meters = await this.meterRepository.findByTenant(tenantId);
    let totalFlushed = 0;

    for (const meter of meters) {
      const result = await this.flushUsageToDB(tenantId, meter.meterId);
      totalFlushed += result.recordsFlushed;
    }

    return { recordsFlushed: totalFlushed };
  }

  /**
   * 특정 기간의 집계된 Usage 조회
   */
  async getAggregatedUsage(options: UsageQueryOptions): Promise<number> {
    return this.usageStorage.getUsage(options);
  }
}
