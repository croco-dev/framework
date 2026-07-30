import { RedisProblem } from "./problems/RedisProblem";
import { buildMeteringRedisKey, encodeRedisKeySegment } from "./redisKey";
import type { RedisClient } from "./RedisClient";
import type { AggregationPeriod, UsageQueryOptions, UsageRecord } from "./types";
import type { AtomicQuotaCheckOptions, AtomicQuotaCheckResult, UsageStorage } from "./UsageStorage";

type ScanDeleteResult = [string | number, number];
type UsageMemberEnvelope = Partial<
  Pick<UsageRecord, "idempotencyKey" | "eventId" | "dimensions" | "metadata">
>;

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
 * - Idempotency 체크를 Redis SET NX로 처리
 */
export class RedisUsageStorage implements UsageStorage {
  private static readonly USAGE_KEY_NAMESPACE = "usage2";
  private static readonly IDEM_KEY_NAMESPACE = "idem2";
  private static readonly RECORD_IDEMPOTENCY_TTL_SECONDS = 86400;
  private static readonly RECORD_IDEMPOTENCY_TTL_MILLISECONDS =
    RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS * 1000;
  private static readonly RECORD_IDEMPOTENCY_CACHE_MAX_ENTRIES = 10_000;
  private static readonly RECORD_IDEMPOTENCY_CACHE_PRUNE_INTERVAL_MILLISECONDS = 60_000;
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
  // Redis remains the idempotency source of truth; this cache only short-circuits duplicate quota writes.
  private readonly recordedRecordKeys = new Map<string, number>();
  private nextRecordIdempotencyCachePruneAt = 0;

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

  private toRedisProblem(operation: string, error: unknown): RedisProblem {
    if (error instanceof RedisProblem) {
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
    const dedupeKey = this.buildRecordIdempotencyKey(
      usage.tenantId,
      usage.meterId,
      usage.idempotencyKey,
    );
    const acquired = await this.runRedisOperation("SET", () =>
      this.redis.set(dedupeKey, "1", "NX", "EX", RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_SECONDS),
    );

    if (acquired !== "OK") {
      return;
    }

    const key = this.buildUsageKey(usage.tenantId, usage.meterId, usage.timestamp, "billing_cycle");
    const member = this.serializeUsageMember(usage);
    const score = usage.timestamp.getTime();

    await this.runRedisOperation("ZADD", () => this.redis.zadd(key, score, member));
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
      const records = await this.runRedisOperation("ZRANGEBYSCORE", () =>
        this.redis.zrangebyscore(key, Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY),
      );
      const currentUsage = this.sumUsageMembers(records);

      return {
        exceeded: false,
        newUsage: currentUsage,
      };
    }

    const [exceeded, newUsage] = await this.runRedisOperation("EVAL", () =>
      this.redis.eval<[number, number]>(
        RedisUsageStorage.buildCheckAndRecordWithinQuotaScript(dedupeKey),
        [key],
        [options.quota, options.value, score, member, options.allowOverQuota ? 1 : 0],
      ),
    );

    if (exceeded !== 1 || options.allowOverQuota) {
      this.rememberRecordIdempotencyKey(dedupeKey);
    }

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
    return buildMeteringRedisKey(RedisUsageStorage.IDEM_KEY_NAMESPACE, [
      "record",
      tenantId,
      meterId,
      idempotencyKey,
    ]);
  }

  private hasRecordedRecordKey(dedupeKey: string): boolean {
    const now = Date.now();

    this.pruneRecordedRecordKeysIfNeeded(now);

    const expiresAt = this.recordedRecordKeys.get(dedupeKey);

    if (expiresAt === undefined) {
      return false;
    }

    if (expiresAt > now) {
      return true;
    }

    this.recordedRecordKeys.delete(dedupeKey);
    return false;
  }

  private rememberRecordIdempotencyKey(dedupeKey: string): void {
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

    this.recordedRecordKeys.set(
      dedupeKey,
      now + RedisUsageStorage.RECORD_IDEMPOTENCY_TTL_MILLISECONDS,
    );
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
    for (const [dedupeKey, expiresAt] of this.recordedRecordKeys) {
      if (expiresAt <= now) {
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
    const value = Number.parseInt(parts[1] ?? "0", 10);
    const payload = parts.length > 2 ? parts.slice(2).join(":") : undefined;
    const envelope = payload?.startsWith("v2.")
      ? this.decodeUsageEnvelope(payload.slice(3))
      : undefined;

    return {
      id,
      value: Number.isNaN(value) ? 0 : value,
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

    const members = records.flatMap((record) => [
      this.serializeUsageMember(record),
      this.serializeLegacyUsageMember(record),
    ]);
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
      throw this.toRedisProblem("ZREM", error);
    }
  }
}
