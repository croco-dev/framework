import { InvalidUsageQueryProblem } from "./problems/InvalidUsageQueryProblem";
import { InvalidUsageValueProblem } from "./problems/InvalidUsageValueProblem";
import { RedisProblem } from "./problems/RedisProblem";
import { buildMeteringRedisKey, encodeRedisKeySegment } from "./redisKey";
import type { RedisClient } from "./RedisClient";
import type { AggregationPeriod, UsageQueryOptions, UsageRecord } from "./types";
import type { AtomicQuotaCheckOptions, AtomicQuotaCheckResult, UsageStorage } from "./UsageStorage";
import { MAX_USAGE_VALUE } from "./usageValueLimits";
import { validateUsageValue } from "./validateUsageValue";

type ScanDeleteResult = [string | number, number];
type UsageMemberEnvelope = Partial<
  Pick<UsageRecord, "idempotencyKey" | "eventId" | "dimensions" | "metadata">
>;
type RecordedQuotaResult = AtomicQuotaCheckResult & {
  expiresAt: number;
};

function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (nestedValue === null || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
      return nestedValue;
    }

    const prototype = Object.getPrototypeOf(nestedValue);
    if (prototype !== Object.prototype && prototype !== null) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
  });
}

/**
 * Redis 기반 UsageStorage 구현체
 *
 * @description
 * - Usage 데이터를 Redis Sorted Set에 저장
 * - Usage 기록과 idempotency marker를 단일 Redis Lua script로 처리
 */
export class RedisUsageStorage implements UsageStorage {
  readonly replayContract = "idempotent" as const;

  private static readonly USAGE_KEY_NAMESPACE = "usage2";
  private static readonly IDEM_KEY_NAMESPACE = "idem2";
  private static readonly RECORD_IDEMPOTENCY_TTL_SECONDS = 86400;
  private static readonly RECORD_IDEMPOTENCY_TTL_MILLISECONDS =
    RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS * 1000;
  private static readonly RECORD_IDEMPOTENCY_CACHE_MAX_ENTRIES = 10_000;
  private static readonly RECORD_IDEMPOTENCY_CACHE_PRUNE_INTERVAL_MILLISECONDS = 60_000;
  private static readonly MAX_BILLING_CYCLE_PARTITIONS = 1_200;
  private static readonly RESET_SCAN_BATCH_SIZE = 500;
  private static readonly RECORD_USAGE_SCRIPT = `
local usageKey = KEYS[1]
local dedupeKey = KEYS[2]
local score = ARGV[1]
local member = ARGV[2]
local ttlSeconds = ARGV[3]

if redis.call('EXISTS', dedupeKey) == 1 then
  return { 0 }
end

redis.call('ZADD', usageKey, score, member)
redis.call('SET', dedupeKey, '1', 'EX', ttlSeconds)

return { 1 }
`;
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
  // Redis remains the idempotency source of truth; this cache only short-circuits duplicate quota writes.
  private readonly recordedRecordKeys = new Map<string, RecordedQuotaResult>();
  private nextRecordIdempotencyCachePruneAt = 0;

  private static readonly CHECK_AND_RECORD_WITHIN_QUOTA_SCRIPT = `
local usageKey = KEYS[1]
local dedupeKey = KEYS[2]
local quota = tonumber(ARGV[1])
local value = tonumber(ARGV[2])
local score = tonumber(ARGV[3])
local member = ARGV[4]
local allowOverQuota = ARGV[5] == '1'
local ttlSeconds = ${RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS}
local maxSafeInteger = ${Number.MAX_SAFE_INTEGER}
local recordedResult = redis.call('GET', dedupeKey)

if recordedResult then
  local recordedExceeded, recordedUsage = string.match(recordedResult, '^quota:([01]):([1-9]%d*)$')
  local recordedUsageNumber = recordedUsage and tonumber(recordedUsage) or nil
  if recordedExceeded and recordedUsageNumber then
    if recordedUsageNumber < 0 or recordedUsageNumber % 1 ~= 0 or recordedUsageNumber > maxSafeInteger then
      return redis.error_reply('Invalid stored quota result')
    end
    return { tonumber(recordedExceeded), recordedUsageNumber }
  end
  if recordedResult ~= '1' then
    return redis.error_reply('Invalid stored quota result')
  end
end

local records = redis.call('ZRANGEBYSCORE', usageKey, '-inf', '+inf')
local currentUsage = 0

for _, existingMember in ipairs(records) do
  local usageValue = string.match(existingMember, '^[^:]+:([1-9]%d*):') or string.match(existingMember, '^[^:]+:([1-9]%d*)$')
  local numericUsageValue = usageValue and tonumber(usageValue)
  if not numericUsageValue or numericUsageValue > ${MAX_USAGE_VALUE} then
    return redis.error_reply('Invalid stored usage value')
  end
  currentUsage = currentUsage + numericUsageValue
  if currentUsage > maxSafeInteger then
    return redis.error_reply('Usage total exceeds the safe integer range')
  end
end

if recordedResult then
  local legacyExceeded = currentUsage > quota
  return { legacyExceeded and 1 or 0, currentUsage }
end

local newUsage = currentUsage + value
if newUsage > maxSafeInteger then
  return redis.error_reply('Usage total exceeds the safe integer range')
end
local exceeded = newUsage > quota

if (not exceeded) or allowOverQuota then
  redis.call('ZADD', usageKey, score, member)
end

redis.call(
  'SET',
  dedupeKey,
  'quota:' .. (exceeded and '1' or '0') .. ':' .. string.format('%.0f', newUsage),
  'EX',
  ttlSeconds
)

return { exceeded and 1 or 0, newUsage }
`;

  constructor(private readonly redis: RedisClient) {}

  private toRedisProblem(
    operation: string,
    error: unknown,
  ): RedisProblem | InvalidUsageQueryProblem {
    if (error instanceof RedisProblem || error instanceof InvalidUsageQueryProblem) {
      return error;
    }

    if (error instanceof Error || typeof error === "string") {
      return new RedisProblem(operation, error);
    }

    return new RedisProblem(operation, error == null ? undefined : String(error));
  }

  private async runRedisOperation<T>(operation: string, command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      throw this.toRedisProblem(operation, error);
    }
  }

  async record(usage: UsageRecord): Promise<void> {
    validateUsageValue(usage.value);

    const key = this.buildUsageKey(usage.tenantId, usage.meterId, usage.timestamp, "billing_cycle");
    const dedupeKey = this.buildRecordIdempotencyKey(
      usage.tenantId,
      usage.meterId,
      usage.idempotencyKey,
    );
    const member = this.serializeUsageMember(usage);
    const score = usage.timestamp.getTime();

    await this.runRedisOperation("EVAL", () =>
      this.redis.eval<[number]>(
        RedisUsageStorage.RECORD_USAGE_SCRIPT,
        [key, dedupeKey],
        [score, member, RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS],
      ),
    );
  }

  async getUsage(options: UsageQueryOptions): Promise<number> {
    try {
      const { members } = await this.readUsageMembers(options);
      return this.sumUsageMembers(members);
    } catch (error) {
      throw this.toRedisProblem("ZRANGEBYSCORE", error);
    }
  }

  async isIdempotent(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    ttlSeconds: number,
  ): Promise<boolean> {
    try {
      const key = this.buildRecordIdempotencyKey(tenantId, meterId, idempotencyKey);
      const result = await this.redis.set(key, "1", "NX", "EX", ttlSeconds);
      return result === "OK";
    } catch (error) {
      throw this.toRedisProblem("SET", error);
    }
  }

  async checkAndRecordWithinQuota(
    options: AtomicQuotaCheckOptions,
  ): Promise<AtomicQuotaCheckResult> {
    validateUsageValue(options.value);
    validateUsageValue(options.usageRecord.value);
    if (options.value !== options.usageRecord.value) {
      throw new InvalidUsageValueProblem(
        options.usageRecord.value,
        "quota value must match usageRecord.value",
      );
    }

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
    const recordedResult = this.getRecordedQuotaResult(dedupeKey);
    if (recordedResult) {
      return recordedResult;
    }

    const [exceeded, newUsage] = await this.runRedisOperation("EVAL", () =>
      this.redis.eval<[number, number]>(
        RedisUsageStorage.CHECK_AND_RECORD_WITHIN_QUOTA_SCRIPT,
        [key, dedupeKey],
        [options.quota, options.value, score, member, options.allowOverQuota ? 1 : 0],
      ),
    );

    this.rememberRecordIdempotencyKey(dedupeKey, {
      exceeded: exceeded === 1,
      newUsage,
    });

    return {
      exceeded: exceeded === 1,
      newUsage,
    };
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
          idempotencyKey: parsed.idempotencyKey ?? parsed.id,
          eventId: parsed.eventId,
          dimensions: parsed.dimensions,
          metadata: parsed.metadata,
        };
      });
    } catch (error) {
      throw this.toRedisProblem("ZRANGEBYSCORE", error);
    }
  }

  /**
   * Usage 키 생성
   * 패턴: usage2:{encodedTenantId}:{encodedMeterId}:{period}
   */
  private buildUsageKey(
    tenantId: string,
    meterId: string,
    date: Date,
    period: AggregationPeriod,
  ): string {
    const periodKey = this.getPeriodKey(date, period);
    return buildMeteringRedisKey(RedisUsageStorage.USAGE_KEY_NAMESPACE, [
      tenantId,
      meterId,
      periodKey,
    ]);
  }

  private getUsageKeyCandidates(
    tenantId: string,
    meterId: string,
    min: number,
    max: number,
    period: AggregationPeriod,
  ): string[] {
    if (period === "billing_cycle") {
      return this.getBillingCycleUsageKeys(tenantId, meterId, min, max);
    }

    const date = new Date(min);
    const primaryKey = this.buildUsageKey(tenantId, meterId, date, period);
    return [primaryKey, this.buildUsageKey(tenantId, meterId, date, "billing_cycle")];
  }

  private getBillingCycleUsageKeys(
    tenantId: string,
    meterId: string,
    min: number,
    max: number,
  ): string[] {
    const start = new Date(min);
    const end = new Date(max);
    const keys: string[] = [];

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      start.getTime() > end.getTime()
    ) {
      return [this.buildUsageKey(tenantId, meterId, start, "billing_cycle")];
    }

    const cursor = new Date(start);
    cursor.setUTCDate(1);
    cursor.setUTCHours(0, 0, 0, 0);
    const endMonth = new Date(end);
    endMonth.setUTCDate(1);
    endMonth.setUTCHours(0, 0, 0, 0);
    const partitionCount =
      (endMonth.getUTCFullYear() - cursor.getUTCFullYear()) * 12 +
      endMonth.getUTCMonth() -
      cursor.getUTCMonth() +
      1;

    if (partitionCount > RedisUsageStorage.MAX_BILLING_CYCLE_PARTITIONS) {
      throw new InvalidUsageQueryProblem(
        `Usage query spans ${partitionCount} billing-cycle partitions; the maximum is ${RedisUsageStorage.MAX_BILLING_CYCLE_PARTITIONS}`,
      );
    }

    while (cursor.getTime() <= endMonth.getTime()) {
      keys.push(this.buildUsageKey(tenantId, meterId, cursor, "billing_cycle"));
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }

    return keys;
  }

  private async readUsageMembers(
    options: UsageQueryOptions,
    withScores?: "WITHSCORES",
  ): Promise<{ key: string; members: string[] }> {
    const { tenantId, meterId, period, startDate, endDate } = options;
    const { min, max } = this.getTimeRange(period, startDate, endDate);
    const partitionMax = startDate && endDate ? max : max - 1;
    const candidates = this.getUsageKeyCandidates(tenantId, meterId, min, partitionMax, period);
    const allMembers: string[] = [];

    for (const key of candidates) {
      const members =
        withScores === "WITHSCORES"
          ? await this.redis.zrangebyscore(key, min, max, withScores)
          : await this.redis.zrangebyscore(key, min, max);

      if (period === "billing_cycle") {
        for (const member of members) {
          allMembers.push(member);
        }
        continue;
      }

      if (members.length > 0) {
        return { key, members };
      }
    }

    return { key: candidates[0], members: allMembers };
  }

  private buildRecordIdempotencyKey(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
  ): string {
    return buildMeteringRedisKey(RedisUsageStorage.IDEM_KEY_NAMESPACE, [
      "record",
      tenantId,
      meterId,
      idempotencyKey,
    ]);
  }

  private getRecordedQuotaResult(dedupeKey: string): AtomicQuotaCheckResult | undefined {
    const now = Date.now();

    this.pruneRecordedRecordKeysIfNeeded(now);

    const recordedResult = this.recordedRecordKeys.get(dedupeKey);

    if (recordedResult === undefined) {
      return undefined;
    }

    if (recordedResult.expiresAt > now) {
      return {
        exceeded: recordedResult.exceeded,
        newUsage: recordedResult.newUsage,
      };
    }

    this.recordedRecordKeys.delete(dedupeKey);
    return undefined;
  }

  private rememberRecordIdempotencyKey(dedupeKey: string, result: AtomicQuotaCheckResult): void {
    const now = Date.now();

    this.pruneRecordedRecordKeysIfNeeded(now);

    if (
      !this.recordedRecordKeys.has(dedupeKey) &&
      this.recordedRecordKeys.size >= RedisUsageStorage.RECORD_IDEMPOTENCY_CACHE_MAX_ENTRIES
    ) {
      this.evictOldestRecordedRecordKeys(
        this.recordedRecordKeys.size - RedisUsageStorage.RECORD_IDEMPOTENCY_CACHE_MAX_ENTRIES + 1,
      );
    }

    this.recordedRecordKeys.set(dedupeKey, {
      ...result,
      expiresAt: now + RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_MILLISECONDS,
    });
  }

  private pruneRecordedRecordKeysIfNeeded(now: number): void {
    if (
      now < this.nextRecordIdempotencyCachePruneAt &&
      this.recordedRecordKeys.size < RedisUsageStorage.RECORD_IDEMPOTENCY_CACHE_MAX_ENTRIES
    ) {
      return;
    }

    this.pruneExpiredRecordedRecordKeys(now);
    this.nextRecordIdempotencyCachePruneAt =
      now + RedisUsageStorage.RECORD_IDEMPOTENCY_CACHE_PRUNE_INTERVAL_MILLISECONDS;
  }

  private pruneExpiredRecordedRecordKeys(now: number): void {
    for (const [dedupeKey, result] of this.recordedRecordKeys) {
      if (result.expiresAt <= now) {
        this.recordedRecordKeys.delete(dedupeKey);
      }
    }
  }

  private evictOldestRecordedRecordKeys(count: number): void {
    let evicted = 0;

    for (const dedupeKey of this.recordedRecordKeys.keys()) {
      this.recordedRecordKeys.delete(dedupeKey);
      evicted += 1;

      if (evicted >= count) {
        return;
      }
    }
  }

  private serializeUsageMember(
    usage: Pick<
      UsageRecord,
      "id" | "value" | "idempotencyKey" | "eventId" | "dimensions" | "metadata"
    >,
  ): string {
    const base = `${usage.id}:${usage.value}`;
    const envelope = {
      idempotencyKey: usage.idempotencyKey,
      eventId: usage.eventId,
      dimensions: usage.dimensions,
      metadata: usage.metadata,
    };

    return `${base}:v2.${encodeURIComponent(stableStringify(envelope))}`;
  }

  private serializeLegacyUsageMember(
    usage: Pick<UsageRecord, "id" | "value" | "metadata">,
  ): string {
    const base = `${usage.id}:${usage.value}`;
    return usage.metadata === undefined
      ? base
      : `${base}:${encodeURIComponent(JSON.stringify(usage.metadata))}`;
  }

  private parseUsageMember(
    member: string,
  ): Pick<UsageRecord, "id" | "value"> & UsageMemberEnvelope {
    const parts = member.split(":");
    const id = parts[0] ?? "";
    const rawValue = parts[1] ?? "";
    const value = Number(rawValue);
    const payload = parts.length > 2 ? parts.slice(2).join(":") : undefined;
    const envelope = payload?.startsWith("v2.")
      ? this.decodeUsageEnvelope(payload.slice(3))
      : undefined;

    if (!/^[1-9]\d*$/.test(rawValue) || !Number.isSafeInteger(value) || value > MAX_USAGE_VALUE) {
      throw new RedisProblem("ZRANGEBYSCORE", `Invalid stored usage value '${rawValue}'`);
    }

    return {
      id,
      value,
      idempotencyKey: envelope?.idempotencyKey,
      eventId: envelope?.eventId,
      dimensions: envelope?.dimensions,
      metadata: envelope?.metadata ?? (payload ? this.decodeMetadata(payload) : undefined),
    };
  }

  private parseScoredUsageMembers(
    membersWithScores: string[],
  ): Array<{ member: string; score: number }> {
    if (membersWithScores.length % 2 !== 0) {
      throw new RedisProblem("ZRANGEBYSCORE", "WITHSCORES returned an odd number of values");
    }

    const members: Array<{ member: string; score: number }> = [];

    for (let index = 0; index < membersWithScores.length; index += 2) {
      const member = membersWithScores[index] ?? "";
      const score = Number(membersWithScores[index + 1]);

      if (!Number.isFinite(score)) {
        throw new RedisProblem(
          "ZRANGEBYSCORE",
          `WITHSCORES returned invalid score '${membersWithScores[index + 1]}'`,
        );
      }

      members.push({ member, score });
    }

    return members;
  }

  private restoreUsageTimestamp(score: number): Date {
    const timestamp = new Date(score);

    if (Number.isNaN(timestamp.getTime())) {
      throw new RedisProblem(
        "ZRANGEBYSCORE",
        `Usage timestamp score '${score}' is not a valid Date`,
      );
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

  private decodeUsageEnvelope(encodedEnvelope: string): UsageMemberEnvelope | undefined {
    try {
      return JSON.parse(decodeURIComponent(encodedEnvelope)) as UsageMemberEnvelope;
    } catch {
      return undefined;
    }
  }

  private sumUsageMembers(members: string[]): number {
    let total = 0;

    for (const member of members) {
      total += this.parseUsageMember(member).value;
      if (!Number.isSafeInteger(total)) {
        throw new RedisProblem("ZRANGEBYSCORE", "Usage total exceeds the safe integer range");
      }
    }

    return total;
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
    const hasStartDate = startDate !== undefined;
    const hasEndDate = endDate !== undefined;

    if (hasStartDate !== hasEndDate) {
      throw new InvalidUsageQueryProblem("startDate and endDate must be provided together");
    }

    if (startDate && endDate) {
      const min = startDate.getTime();
      const max = endDate.getTime();

      if (!Number.isFinite(min) || !Number.isFinite(max)) {
        throw new InvalidUsageQueryProblem("dates must be valid");
      }

      if (min > max) {
        throw new InvalidUsageQueryProblem("startDate must not be after endDate");
      }

      return {
        min,
        max,
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
      if (meterId !== undefined) {
        const key = this.buildUsageKey(tenantId, meterId, new Date(), "billing_cycle");
        await this.redis.eval<[number]>('return redis.call("DEL", KEYS[1])', [key], []);
      } else {
        const now = new Date();
        const periodKey = this.getPeriodKey(now, "billing_cycle");
        await this.deleteTenantBillingCycleUsageKeys(tenantId, periodKey);
      }
    } catch (error) {
      throw this.toRedisProblem(meterId !== undefined ? "DEL" : "SCAN", error);
    }
  }

  private async deleteTenantBillingCycleUsageKeys(
    tenantId: string,
    periodKey: string,
  ): Promise<void> {
    const encodedTenantId = encodeRedisKeySegment(tenantId);
    const keyPattern = `${RedisUsageStorage.USAGE_KEY_NAMESPACE}:${encodedTenantId}:*:${periodKey}`;
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

  async deleteUsageRecords(options: UsageQueryOptions, records: UsageRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    const { min, max } = this.getTimeRange(options.period, options.startDate, options.endDate);
    const partitionMax = options.startDate && options.endDate ? max : max - 1;
    const keys = this.getUsageKeyCandidates(
      options.tenantId,
      options.meterId,
      min,
      partitionMax,
      options.period,
    );
    const membersByKey = new Map<string, string[]>();

    if (options.period === "billing_cycle") {
      const candidateKeys = new Set(keys);

      for (const record of records) {
        const key = this.buildUsageKey(
          options.tenantId,
          options.meterId,
          record.timestamp,
          "billing_cycle",
        );

        if (!candidateKeys.has(key)) {
          continue;
        }

        const members = membersByKey.get(key) ?? [];
        members.push(this.serializeUsageMember(record), this.serializeLegacyUsageMember(record));
        membersByKey.set(key, members);
      }
    } else {
      const members = records.flatMap((record) => [
        this.serializeUsageMember(record),
        this.serializeLegacyUsageMember(record),
      ]);

      for (const key of keys) {
        membersByKey.set(key, members);
      }
    }

    const script = `
local removed = 0
local usageKey = KEYS[1]
for _, member in ipairs(ARGV) do
  removed = removed + redis.call('ZREM', usageKey, member)
end
return removed
`;

    try {
      for (const [key, members] of membersByKey) {
        await this.redis.eval<[number]>(script, [key], members);
      }
    } catch (error) {
      throw this.toRedisProblem("ZREM", error);
    }
  }
}
