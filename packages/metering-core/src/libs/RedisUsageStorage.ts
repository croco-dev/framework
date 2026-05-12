import { RedisProblem } from "./problems/RedisProblem";
import type { RedisClient } from "./RedisClient";
import type { AggregationPeriod, UsageQueryOptions, UsageRecord } from "./types";
import type { AtomicQuotaCheckOptions, AtomicQuotaCheckResult, UsageStorage } from "./UsageStorage";

/**
 * Redis 기반 UsageStorage 구현체
 *
 * @description
 * - Usage 데이터를 Redis Sorted Set에 저장
 * - Idempotency 체크를 Redis SET NX로 처리
 */
export class RedisUsageStorage implements UsageStorage {
  private static readonly USAGE_KEY_PREFIX = "usage";
  private static readonly IDEM_KEY_PREFIX = "idem";
  private static readonly CHECK_AND_RECORD_WITHIN_QUOTA_SCRIPT = `
local usageKey = KEYS[1]
local quota = tonumber(ARGV[1])
local value = tonumber(ARGV[2])
local score = tonumber(ARGV[3])
local member = ARGV[4]
local allowOverQuota = ARGV[5] == '1'
local records = redis.call('ZRANGEBYSCORE', usageKey, '-inf', '+inf')
local currentUsage = 0

for _, existingMember in ipairs(records) do
  local usageValue = string.match(existingMember, ':(%d+)$')
  if usageValue then
    currentUsage = currentUsage + tonumber(usageValue)
  end
end

local newUsage = currentUsage + value
local exceeded = newUsage > quota

if (not exceeded) or allowOverQuota then
  redis.call('ZADD', usageKey, score, member)
end

return { exceeded and 1 or 0, newUsage }
`;

  constructor(private readonly redis: RedisClient) {}

  async record(usage: UsageRecord): Promise<void> {
    try {
      const key = this.buildUsageKey(usage.tenantId, usage.meterId, usage.timestamp);
      const member = `${usage.id}:${usage.value}`;
      const score = usage.timestamp.getTime();

      await this.redis.zadd(key, score, member);
    } catch (error) {
      throw new RedisProblem("ZADD", error instanceof Error ? error : undefined);
    }
  }

  async getUsage(options: UsageQueryOptions): Promise<number> {
    try {
      const { tenantId, meterId, period, startDate, endDate } = options;
      const { min, max } = this.getTimeRange(period, startDate, endDate);
      const key = this.buildUsageKey(tenantId, meterId, new Date(min));

      const members = await this.redis.zrangebyscore(key, min, max);

      // member 형식: "usageId:value"
      return members.reduce((total, member) => {
        const value = this.parseValue(member);
        return total + value;
      }, 0);
    } catch (error) {
      throw new RedisProblem("ZRANGEBYSCORE", error instanceof Error ? error : undefined);
    }
  }

  async isIdempotent(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const key = `${RedisUsageStorage.IDEM_KEY_PREFIX}:${tenantId}:${meterId}:${idempotencyKey}`;
      const result = await this.redis.set(key, "1", "NX", "EX", ttlSeconds);
      return result === "OK";
    } catch (error) {
      throw new RedisProblem("SET", error instanceof Error ? error : undefined);
    }
  }

  async checkAndRecordWithinQuota(
    options: AtomicQuotaCheckOptions,
  ): Promise<AtomicQuotaCheckResult> {
    try {
      const key = this.buildUsageKey(
        options.tenantId,
        options.meterId,
        options.usageRecord.timestamp,
      );
      const score = options.usageRecord.timestamp.getTime();
      const member = `${options.usageRecord.id}:${options.usageRecord.value}`;
      const [exceeded, newUsage] = await this.redis.eval<[number, number]>(
        RedisUsageStorage.CHECK_AND_RECORD_WITHIN_QUOTA_SCRIPT,
        [key],
        [options.quota, options.value, score, member, options.allowOverQuota ? 1 : 0],
      );

      return {
        exceeded: exceeded === 1,
        newUsage,
      };
    } catch (error) {
      throw new RedisProblem("EVAL", error instanceof Error ? error : undefined);
    }
  }

  async fetchUsageRecords(options: UsageQueryOptions): Promise<UsageRecord[]> {
    try {
      const { tenantId, meterId, period, startDate, endDate } = options;
      const { min, max } = this.getTimeRange(period, startDate, endDate);
      const key = this.buildUsageKey(tenantId, meterId, new Date(min));

      const members = await this.redis.zrangebyscore(key, min, max);

      return members.map((member) => {
        const [id, valueStr] = member.split(":");
        return {
          id,
          tenantId,
          meterId,
          value: Number.parseInt(valueStr, 10),
          timestamp: new Date(), // Score에서 복원해야 하지만 단순화
          idempotencyKey: id, // 단순화
        };
      });
    } catch (error) {
      throw new RedisProblem("ZRANGEBYSCORE", error instanceof Error ? error : undefined);
    }
  }

  /**
   * Usage 키 생성
   * 패턴: usage:{tenantId}:{meterId}:{period}
   */
  private buildUsageKey(tenantId: string, meterId: string, date: Date): string {
    const periodKey = this.getPeriodKey(date, "billing_cycle");
    return `${RedisUsageStorage.USAGE_KEY_PREFIX}:${tenantId}:${meterId}:${periodKey}`;
  }

  /**
   * Period별 키 생성
   */
  private getPeriodKey(date: Date, period: AggregationPeriod): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    const hour = String(date.getUTCHours()).padStart(2, "0");

    switch (period) {
      case "hour":
        return `${year}-${month}-${day}-${hour}`;
      case "day":
        return `${year}-${month}-${day}`;
      case "billing_cycle":
        return `${year}-${month}`;
    }
  }

  /**
   * 시간 범위 계산
   */
  private getTimeRange(
    period: AggregationPeriod,
    startDate?: Date,
    endDate?: Date,
  ): { min: number; max: number } {
    const now = new Date();

    if (startDate && endDate) {
      return {
        min: startDate.getTime(),
        max: endDate.getTime(),
      };
    }

    // 기본: 현재 period의 시작~끝
    switch (period) {
      case "hour": {
        const start = new Date(now);
        start.setUTCMinutes(0, 0, 0);
        const end = new Date(start);
        end.setUTCHours(end.getUTCHours() + 1);
        return { min: start.getTime(), max: end.getTime() };
      }
      case "day": {
        const start = new Date(now);
        start.setUTCHours(0, 0, 0, 0);
        const end = new Date(start);
        end.setUTCDate(end.getUTCDate() + 1);
        return { min: start.getTime(), max: end.getTime() };
      }
      case "billing_cycle": {
        const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
        return { min: start.getTime(), max: end.getTime() };
      }
    }
  }

  /**
   * member에서 value 파싱
   * 형식: "usageId:value"
   */
  private parseValue(member: string): number {
    const parts = member.split(":");
    const value = Number.parseInt(parts[parts.length - 1], 10);
    return Number.isNaN(value) ? 0 : value;
  }

  /**
   * 빌링 주기 리셋
   * 현재 빌링 주기의 모든 usage 데이터를 삭제합니다.
   */
  async resetBillingCycle(tenantId: string, meterId?: string): Promise<void> {
    try {
      if (meterId) {
        const key = this.buildUsageKey(tenantId, meterId, new Date());
        await this.redis.eval<[number]>('return redis.call("DEL", KEYS[1])', [key], []);
      } else {
        const now = new Date();
        const periodKey = this.getPeriodKey(now, "billing_cycle");
        const keyPattern = `${RedisUsageStorage.USAGE_KEY_PREFIX}:${tenantId}:*:${periodKey}`;

        await this.redis.eval<[number]>(
          `
          local keys = redis.call('KEYS', ARGV[1])
          for _, key in ipairs(keys) do
            redis.call('DEL', key)
          end
          return #keys
          `,
          [],
          [keyPattern],
        );
      }
    } catch (error) {
      throw new RedisProblem("DEL", error instanceof Error ? error : undefined);
    }
  }
}
