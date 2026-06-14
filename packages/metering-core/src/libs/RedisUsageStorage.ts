import { RedisProblem } from "./problems/RedisProblem";
import type { RedisClient } from "./RedisClient";
import type { AggregationPeriod, UsageQueryOptions, UsageRecord } from "./types";
import type { AtomicQuotaCheckOptions, AtomicQuotaCheckResult, UsageStorage } from "./UsageStorage";

type ScanDeleteResult = [string | number, number];

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
  private static readonly RECORD_IDEMPOTENCY_TTL_SECONDS = 86400;
  private static readonly RESET_SCAN_BATCH_SIZE = 500;
  private static readonly SCAN_AND_DELETE_USAGE_KEYS_SCRIPT = `
local cursor = ARGV[1]
local pattern = ARGV[2]
local count = tonumber(ARGV[3])
local result = redis.call('SCAN', cursor, 'MATCH', pattern, 'COUNT', count)
local nextCursor = result[1]
local keys = result[2]

if #keys > 0 then
  redis.call('DEL', unpack(keys))
end

return { nextCursor, #keys }
`;
  private readonly recordedRecordKeys = new Map<string, number>();

  private static buildCheckAndRecordWithinQuotaScript(dedupeKey: string): string {
    const dedupeKeyLiteral = RedisUsageStorage.toLuaLongString(dedupeKey);

    return `
local usageKey = KEYS[1]
local dedupeKey = ${dedupeKeyLiteral}
local quota = tonumber(ARGV[1])
local value = tonumber(ARGV[2])
local score = tonumber(ARGV[3])
local member = ARGV[4]
local allowOverQuota = ARGV[5] == '1'
local ttlSeconds = ${RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS}
local records = redis.call('ZRANGEBYSCORE', usageKey, '-inf', '+inf')
local currentUsage = 0

for _, existingMember in ipairs(records) do
  local usageValue = string.match(existingMember, '^[^:]+:(%d+):') or string.match(existingMember, '^[^:]+:(%d+)$')
  if usageValue then
    currentUsage = currentUsage + tonumber(usageValue)
  end
end

if redis.call('EXISTS', dedupeKey) == 1 then
  return { 0, currentUsage }
end

local newUsage = currentUsage + value
local exceeded = newUsage > quota

if (not exceeded) or allowOverQuota then
  redis.call('ZADD', usageKey, score, member)
  redis.call('SET', dedupeKey, '1', 'EX', ttlSeconds)
end

return { exceeded and 1 or 0, newUsage }
`;
  }

  private static toLuaLongString(value: string): string {
    let delimiter = "=";

    while (value.includes(`]${delimiter}]`)) {
      delimiter += "=";
    }

    return `[${delimiter}[${value}]${delimiter}]`;
  }

  constructor(private readonly redis: RedisClient) {}

  async record(usage: UsageRecord): Promise<void> {
    try {
      const dedupeKey = this.buildRecordIdempotencyKey(
        usage.tenantId,
        usage.meterId,
        usage.idempotencyKey,
      );
      const acquired = await this.redis.set(
        dedupeKey,
        "1",
        "NX",
        "EX",
        RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS,
      );

      if (acquired !== "OK") {
        return;
      }

      const key = this.buildUsageKey(
        usage.tenantId,
        usage.meterId,
        usage.timestamp,
        "billing_cycle",
      );
      const member = this.serializeUsageMember(usage);
      const score = usage.timestamp.getTime();

      await this.redis.zadd(key, score, member);
    } catch (error) {
      throw new RedisProblem("ZADD", error instanceof Error ? error : undefined);
    }
  }

  async getUsage(options: UsageQueryOptions): Promise<number> {
    try {
      const { members } = await this.readUsageMembers(options);
      return this.sumUsageMembers(members);
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
        "billing_cycle",
      );
      const dedupeKey = this.buildRecordIdempotencyKey(
        options.tenantId,
        options.meterId,
        options.usageRecord.idempotencyKey,
      );
      const score = options.usageRecord.timestamp.getTime();
      const member = this.serializeUsageMember(options.usageRecord);
      if (this.hasRecordedRecordKey(dedupeKey)) {
        const records = await this.redis.zrangebyscore(
          key,
          Number.NEGATIVE_INFINITY,
          Number.POSITIVE_INFINITY,
        );
        const currentUsage = this.sumUsageMembers(records);

        return {
          exceeded: false,
          newUsage: currentUsage,
        };
      }

      const [exceeded, newUsage] = await this.redis.eval<[number, number]>(
        RedisUsageStorage.buildCheckAndRecordWithinQuotaScript(dedupeKey),
        [key],
        [options.quota, options.value, score, member, options.allowOverQuota ? 1 : 0],
      );

      if (exceeded !== 1 || options.allowOverQuota) {
        this.rememberRecordIdempotencyKey(dedupeKey);
      }

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
      const { members } = await this.readUsageMembers(options, "WITHSCORES");

      return this.parseScoredUsageMembers(members).map(({ member, score }) => {
        const parsed = this.parseUsageMember(member);

        return {
          id: parsed.id,
          tenantId: options.tenantId,
          meterId: options.meterId,
          value: parsed.value,
          timestamp: this.restoreUsageTimestamp(score),
          idempotencyKey: parsed.id,
          metadata: parsed.metadata,
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
  private buildUsageKey(
    tenantId: string,
    meterId: string,
    date: Date,
    period: AggregationPeriod,
  ): string {
    const periodKey = this.getPeriodKey(date, period);
    return `${RedisUsageStorage.USAGE_KEY_PREFIX}:${tenantId}:${meterId}:${periodKey}`;
  }

  private getUsageKeyCandidates(
    tenantId: string,
    meterId: string,
    date: Date,
    period: AggregationPeriod,
  ): string[] {
    const primaryKey = this.buildUsageKey(tenantId, meterId, date, period);
    if (period === "billing_cycle") {
      return [primaryKey];
    }

    return [primaryKey, this.buildUsageKey(tenantId, meterId, date, "billing_cycle")];
  }

  private async readUsageMembers(
    options: UsageQueryOptions,
    withScores?: "WITHSCORES",
  ): Promise<{ key: string; members: string[] }> {
    const { tenantId, meterId, period, startDate, endDate } = options;
    const { min, max } = this.getTimeRange(period, startDate, endDate);
    const candidates = this.getUsageKeyCandidates(tenantId, meterId, new Date(min), period);

    for (const key of candidates) {
      const members =
        withScores === "WITHSCORES"
          ? await this.redis.zrangebyscore(key, min, max, withScores)
          : await this.redis.zrangebyscore(key, min, max);
      if (members.length > 0) {
        return { key, members };
      }
    }

    return { key: candidates[0], members: [] };
  }

  private buildRecordIdempotencyKey(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): string {
    return `${RedisUsageStorage.IDEM_KEY_PREFIX}:${tenantId}:${meterId}:${idempotencyKey}`;
  }

  private hasRecordedRecordKey(dedupeKey: string): boolean {
    const expiresAt = this.recordedRecordKeys.get(dedupeKey);

    if (expiresAt === undefined) {
      return false;
    }

    if (expiresAt > Date.now()) {
      return true;
    }

    this.recordedRecordKeys.delete(dedupeKey);
    return false;
  }

  private rememberRecordIdempotencyKey(dedupeKey: string): void {
    const ttlMilliseconds = RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS * 1000;
    this.recordedRecordKeys.set(dedupeKey, Date.now() + ttlMilliseconds);
  }
  private serializeUsageMember(usage: Pick<UsageRecord, "id" | "value" | "metadata">): string {
    const base = `${usage.id}:${usage.value}`;

    if (usage.metadata === undefined) {
      return base;
    }

    return `${base}:${encodeURIComponent(JSON.stringify(usage.metadata))}`;
  }

  private parseUsageMember(member: string): {
    id: string;
    value: number;
    metadata?: Record<string, unknown>;
  } {
    const parts = member.split(":");
    const id = parts[0] ?? "";
    const value = Number.parseInt(parts[1] ?? "0", 10);
    const metadataEncoded = parts.length > 2 ? parts.slice(2).join(":") : undefined;

    return {
      id,
      value: Number.isNaN(value) ? 0 : value,
      metadata: metadataEncoded ? this.decodeMetadata(metadataEncoded) : undefined,
    };
  }

  private parseScoredUsageMembers(
    membersWithScores: string[],
  ): Array<{ member: string; score: number }> {
    if (membersWithScores.length % 2 !== 0) {
      throw new Error("Redis ZRANGEBYSCORE WITHSCORES returned an odd number of values");
    }

    const members: Array<{ member: string; score: number }> = [];

    for (let index = 0; index < membersWithScores.length; index += 2) {
      const member = membersWithScores[index] ?? "";
      const score = Number(membersWithScores[index + 1]);

      if (!Number.isFinite(score)) {
        throw new Error(
          `Redis ZRANGEBYSCORE WITHSCORES returned invalid score '${membersWithScores[index + 1]}'`,
        );
      }

      members.push({ member, score });
    }

    return members;
  }

  private restoreUsageTimestamp(score: number): Date {
    const timestamp = new Date(score);

    if (Number.isNaN(timestamp.getTime())) {
      throw new Error(`Redis usage timestamp score '${score}' is not a valid Date`);
    }

    return timestamp;
  }

  private decodeMetadata(encodedMetadata: string): Record<string, unknown> | undefined {
    try {
      const decoded = decodeURIComponent(encodedMetadata);
      const parsed = JSON.parse(decoded) as Record<string, unknown>;
      return parsed;
    } catch {
      return undefined;
    }
  }

  private sumUsageMembers(members: string[]): number {
    return members.reduce((total, member) => total + this.parseUsageMember(member).value, 0);
  }

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
   * 빌링 주기 리셋
   * 현재 빌링 주기의 모든 usage 데이터를 삭제합니다.
   */
  async resetBillingCycle(tenantId: string, meterId?: string): Promise<void> {
    try {
      if (meterId) {
        const key = this.buildUsageKey(tenantId, meterId, new Date(), "billing_cycle");
        await this.redis.eval<[number]>('return redis.call("DEL", KEYS[1])', [key], []);
      } else {
        const now = new Date();
        const periodKey = this.getPeriodKey(now, "billing_cycle");
        await this.deleteTenantBillingCycleUsageKeys(tenantId, periodKey);
      }
    } catch (error) {
      throw new RedisProblem(meterId ? "DEL" : "SCAN", error instanceof Error ? error : undefined);
    }
  }

  private async deleteTenantBillingCycleUsageKeys(
    tenantId: string,
    periodKey: string,
  ): Promise<void> {
    const keyPattern = `${RedisUsageStorage.USAGE_KEY_PREFIX}:${this.escapeRedisGlob(tenantId)}:*:${periodKey}`;
    let cursor = "0";

    do {
      const [nextCursor] = await this.redis.eval<ScanDeleteResult>(
        RedisUsageStorage.SCAN_AND_DELETE_USAGE_KEYS_SCRIPT,
        [],
        [cursor, keyPattern, RedisUsageStorage.RESET_SCAN_BATCH_SIZE],
      );
      cursor = String(nextCursor);
    } while (cursor !== "0");
  }

  private escapeRedisGlob(value: string): string {
    return value.replace(/[\\*?[\]]/g, "\\$&");
  }

  async deleteUsageRecords(options: UsageQueryOptions, records: UsageRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const members = records.map((record) => this.serializeUsageMember(record));
    const { min } = this.getTimeRange(options.period, options.startDate, options.endDate);
    const keys = this.getUsageKeyCandidates(
      options.tenantId,
      options.meterId,
      new Date(min),
      options.period,
    );
    const script = `
local removed = 0
local usageKey = KEYS[1]
for _, member in ipairs(ARGV) do
  removed = removed + redis.call('ZREM', usageKey, member)
end
return removed
`;

    try {
      for (const key of keys) {
        await this.redis.eval<[number]>(script, [key], members);
      }
    } catch (error) {
      throw new RedisProblem("ZREM", error instanceof Error ? error : undefined);
    }
  }
}
