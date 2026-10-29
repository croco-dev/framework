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
  recorded: boolean;
  expiresAt: number;
};
type ParsedUsageMember = Pick<UsageRecord, "id" | "value"> & UsageMemberEnvelope;
type ReconciledUsageMember = {
  member: string;
  parsed: ParsedUsageMember;
  score?: number;
};
const MAX_USAGE_JSON_DEPTH = 1_000;

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

function parseUsageJson(json: string, operation: "SERIALIZE" | "ZRANGEBYSCORE"): unknown {
  // Validate original tokens: JSON.parse discards overwritten duplicate properties before a reviver runs.
  let depth = 0;
  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];
    if (character === '"') {
      const start = index;
      index += 1;
      while (index < json.length) {
        if (json[index] === "\\") {
          index += 2;
        } else if (json[index] === '"') {
          break;
        } else {
          index += 1;
        }
      }
      const token: unknown = JSON.parse(json.slice(start, index + 1));
      if (typeof token === "string") {
        encodeURIComponent(token);
      }
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > MAX_USAGE_JSON_DEPTH) {
        throw new RedisProblem(
          operation,
          `Usage JSON exceeds the maximum depth of ${MAX_USAGE_JSON_DEPTH}`,
        );
      }
    } else if (character === "}" || character === "]") {
      depth -= 1;
    }
  }
  return JSON.parse(json);
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
  private static readonly MAX_PERIOD_PARTITIONS = 1_200;
  private static readonly PARTITION_READ_CONCURRENCY = 16;
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
  local recordedExceeded, wasRecorded, recordedUsage = string.match(recordedResult, '^quota:([01]):([01]):([1-9]%d*)$')
  local recordedUsageNumber = recordedUsage and tonumber(recordedUsage) or nil
  if recordedExceeded and wasRecorded and recordedUsageNumber then
    if recordedUsageNumber < 0 or recordedUsageNumber % 1 ~= 0 or recordedUsageNumber > maxSafeInteger then
      return redis.error_reply('Invalid stored quota result')
    end
    if recordedExceeded == '0' and wasRecorded == '0' then
      return redis.error_reply('Invalid stored quota result')
    end
    if wasRecorded == '1' then
      return { tonumber(recordedExceeded), recordedUsageNumber }
    end
  else
    local legacyExceeded, legacyUsage = string.match(recordedResult, '^quota:([01]):([1-9]%d*)$')
    local legacyUsageNumber = legacyUsage and tonumber(legacyUsage) or nil
    if legacyExceeded and legacyUsageNumber then
      if legacyUsageNumber < 0 or legacyUsageNumber % 1 ~= 0 or legacyUsageNumber > maxSafeInteger then
        return redis.error_reply('Invalid stored quota result')
      end
      return { tonumber(legacyExceeded), legacyUsageNumber }
    end
    if recordedResult ~= '1' then
      return redis.error_reply('Invalid stored quota result')
    end
  end
end

-- URI components never contain raw colons, so extra fields are ambiguous legacy data.
local function decodeComponent(component)
  if string.find(string.gsub(component, '%%[%x][%x]', ''), '%%') then
    return nil
  end
  local decoded = (string.gsub(component, '%%(%x%x)', function(hex)
    return string.char(tonumber(hex, 16))
  end))
  -- Match decodeURIComponent: shortest UTF-8 sequences for Unicode scalar values only.
  local index = 1
  while index <= #decoded do
    local first = string.byte(decoded, index)
    if first <= 0x7F then
      index = index + 1
    else
      local length = nil
      local minimumSecond = 0x80
      local maximumSecond = 0xBF
      if first >= 0xC2 and first <= 0xDF then
        length = 2
      elseif first >= 0xE0 and first <= 0xEF then
        length = 3
        if first == 0xE0 then minimumSecond = 0xA0 end
        if first == 0xED then maximumSecond = 0x9F end
      elseif first >= 0xF0 and first <= 0xF4 then
        length = 4
        if first == 0xF0 then minimumSecond = 0x90 end
        if first == 0xF4 then maximumSecond = 0x8F end
      else
        return nil
      end
      local second = string.byte(decoded, index + 1)
      if not second or second < minimumSecond or second > maximumSecond then
        return nil
      end
      for offset = 2, length - 1 do
        local continuation = string.byte(decoded, index + offset)
        if not continuation or continuation < 0x80 or continuation > 0xBF then
          return nil
        end
      end
      index = index + length
    end
  end
  return decoded
end

-- Isolate decoder settings from other scripts sharing Redis's Lua VM.
if type(cjson.new) ~= 'function' then
  return redis.error_reply('Usage quota evaluation requires an isolated Lua CJSON decoder')
end
local usageJson = cjson.new()
usageJson.decode_invalid_numbers(false)
usageJson.decode_max_depth(${MAX_USAGE_JSON_DEPTH})

local function decodeUsageJson(encoded)
  local decoded = decodeComponent(encoded)
  if not decoded then return nil end
  local start = 1
  while start <= #decoded do
    local byte = string.byte(decoded, start)
    if byte ~= 0x20 and byte ~= 0x09 and byte ~= 0x0A and byte ~= 0x0D then break end
    start = start + 1
  end
  if string.byte(decoded, start) ~= 0x7B then return nil end
  local quoted = false
  local escaped = false
  for index = start, #decoded do
    local byte = string.byte(decoded, index)
    if quoted then
      if byte < 0x20 then return nil end
      if escaped then
        escaped = false
      elseif byte == 0x5C then
        escaped = true
      elseif byte == 0x22 then
        quoted = false
      end
    elseif byte == 0x22 then
      quoted = true
    elseif byte < 0x20 and byte ~= 0x09 and byte ~= 0x0A and byte ~= 0x0D then
      return nil
    elseif byte == 0x2E then
      -- CJSON accepts a missing fractional part; JSON.parse does not.
      local nextByte = string.byte(decoded, index + 1)
      if not nextByte or nextByte < 0x30 or nextByte > 0x39 then return nil end
    end
  end
  local ok, parsed = pcall(usageJson.decode, decoded)
  if not ok or type(parsed) ~= 'table' then return nil end
  return parsed
end

local records = redis.call('ZRANGEBYSCORE', usageKey, '-inf', '+inf', 'WITHSCORES')
local parents = {}
local values = {}
local scores = {}
local firstIndexByIdentity = {}

local function findRoot(index)
  local root = index
  while parents[root] ~= root do
    root = parents[root]
  end
  while parents[index] ~= index do
    local parent = parents[index]
    parents[index] = root
    index = parent
  end
  return root
end

for index = 1, #records, 2 do
  local existingMember = records[index]
  local numericScore = tonumber(records[index + 1])
  if not numericScore or numericScore == math.huge or numericScore == -math.huge then
    return redis.error_reply('Invalid stored usage score')
  end
  local id, usageValue, payload = string.match(existingMember, '^([^:]*):([1-9]%d*):([^:]*)$')
  local envelope = nil
  if not payload then
    id, usageValue = string.match(existingMember, '^([^:]+):([1-9]%d*)$')
  else
    local version = string.sub(payload, 1, 3)
    if version == 'v3.' then
      id = decodeComponent(id)
      if not id then
        return redis.error_reply('Invalid stored usage ID')
      end
    elseif id == '' then
      return redis.error_reply('Invalid stored usage ID')
    end
    if version == 'v2.' or version == 'v3.' then
      payload = string.sub(payload, 4)
    end
    local parsed = decodeUsageJson(payload)
    if not parsed then
      return redis.error_reply('Invalid stored usage payload')
    end
    if version == 'v2.' or version == 'v3.' then
      if (parsed.idempotencyKey ~= nil and type(parsed.idempotencyKey) ~= 'string') or
         (parsed.eventId ~= nil and type(parsed.eventId) ~= 'string') then
        return redis.error_reply('Invalid stored usage identity')
      end
      envelope = parsed
    end
  end
  local numericUsageValue = usageValue and tonumber(usageValue)
  if not numericUsageValue or numericUsageValue > ${MAX_USAGE_VALUE} then
    return redis.error_reply('Invalid stored usage value')
  end

  parents[index] = index
  values[index] = numericUsageValue
  scores[index] = numericScore
  local identities = { 'id:' .. id, 'idempotency:' .. (envelope and envelope.idempotencyKey or id) }
  if envelope and envelope.eventId ~= nil then
    table.insert(identities, 'event:' .. envelope.eventId)
  end
  for _, identity in ipairs(identities) do
    local previousIndex = firstIndexByIdentity[identity]
    if previousIndex then
      local previousRoot = findRoot(previousIndex)
      if values[previousRoot] ~= numericUsageValue or scores[previousRoot] ~= numericScore then
        return redis.error_reply('Conflicting stored usage record across Redis members')
      end
      parents[findRoot(index)] = previousRoot
    else
      firstIndexByIdentity[identity] = index
    end
  end
end

local currentUsage = 0
for index = 1, #records, 2 do
  if parents[index] == index then
    currentUsage = currentUsage + values[index]
    if currentUsage > maxSafeInteger then
      return redis.error_reply('Usage total exceeds the safe integer range')
    end
  end
end

if recordedResult == '1' then
  local legacyExceeded = currentUsage > quota
  return { legacyExceeded and 1 or 0, currentUsage }
end

local newUsage = currentUsage + value
if newUsage > maxSafeInteger then
  return redis.error_reply('Usage total exceeds the safe integer range')
end
local exceeded = newUsage > quota
local shouldRecord = (not exceeded) or allowOverQuota

if shouldRecord then
  redis.call('ZADD', usageKey, score, member)
end

redis.call(
  'SET',
  dedupeKey,
  'quota:' .. (exceeded and '1' or '0') .. ':' .. (shouldRecord and '1' or '0') .. ':' .. string.format('%.0f', newUsage),
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
      const { members } = await this.readUsageMembers(options, "WITHSCORES");
      return this.sumUsageMembers(
        this.parseScoredUsageMembers(members).map(({ member }) => member),
      );
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

    this.rememberRecordIdempotencyKey(
      dedupeKey,
      {
        exceeded: exceeded === 1,
        newUsage,
      },
      exceeded !== 1 || options.allowOverQuota,
    );

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

    return [
      ...this.getPeriodUsageKeys(tenantId, meterId, min, max, period),
      ...this.getBillingCycleUsageKeys(tenantId, meterId, min, max),
    ];
  }

  private getPeriodUsageKeys(
    tenantId: string,
    meterId: string,
    min: number,
    max: number,
    period: Exclude<AggregationPeriod, "billing_cycle">,
  ): string[] {
    const cursor = new Date(min);
    const end = new Date(max);
    const keys: string[] = [];

    if (period === "hour") {
      cursor.setUTCMinutes(0, 0, 0);
    } else {
      cursor.setUTCHours(0, 0, 0, 0);
    }

    while (cursor.getTime() <= end.getTime()) {
      if (keys.length >= RedisUsageStorage.MAX_PERIOD_PARTITIONS) {
        throw new InvalidUsageQueryProblem(
          `Usage query spans more than ${RedisUsageStorage.MAX_PERIOD_PARTITIONS} ${period} partitions`,
        );
      }

      keys.push(this.buildUsageKey(tenantId, meterId, cursor, period));
      if (period === "hour") {
        cursor.setUTCHours(cursor.getUTCHours() + 1);
      } else {
        cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
    }

    return keys;
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

    for (
      let offset = 0;
      offset < candidates.length;
      offset += RedisUsageStorage.PARTITION_READ_CONCURRENCY
    ) {
      const batch = candidates.slice(offset, offset + RedisUsageStorage.PARTITION_READ_CONCURRENCY);
      const batchMembers = await Promise.all(
        batch.map((key) =>
          withScores === "WITHSCORES"
            ? this.redis.zrangebyscore(key, min, partitionMax, withScores)
            : this.redis.zrangebyscore(key, min, partitionMax),
        ),
      );

      for (const members of batchMembers) {
        if (withScores === "WITHSCORES") {
          this.parseScoredUsageMembers(members);
        }
        for (const member of members) {
          allMembers.push(member);
        }
      }
    }

    return {
      key: candidates[0],
      members: this.reconcileUsageMembers(allMembers, withScores === "WITHSCORES"),
    };
  }

  private reconcileUsageMembers(members: string[], withScores: boolean): string[] {
    const parsedMembers: ReconciledUsageMember[] = withScores
      ? this.parseScoredUsageMembers(members).map(({ member, score }) => ({
          member,
          parsed: this.parseUsageMember(member),
          score,
        }))
      : members.map((member) => ({ member, parsed: this.parseUsageMember(member) }));
    const reconciled = this.groupUsageMembers(parsedMembers).map(([first, ...duplicates]) => {
      let preferred = first;
      for (const candidate of duplicates) {
        if (
          this.getUsageMemberRichness(candidate.parsed) >
          this.getUsageMemberRichness(preferred.parsed)
        ) {
          preferred = candidate;
        }
      }
      return preferred;
    });

    return reconciled.flatMap(({ member, score }) =>
      withScores ? [member, String(score)] : [member],
    );
  }

  private groupUsageMembers<T extends ReconciledUsageMember>(
    parsedMembers: T[],
  ): Array<[T, ...T[]]> {
    const parents = parsedMembers.map((_, index) => index);
    const findRoot = (index: number): number => {
      let root = index;
      while (parents[root] !== root) {
        root = parents[root] ?? root;
      }
      while (parents[index] !== index) {
        const parent = parents[index] ?? root;
        parents[index] = root;
        index = parent;
      }
      return root;
    };
    const firstIndexByIdentity = new Map<string, number>();

    parsedMembers.forEach(({ parsed }, index) => {
      for (const identity of this.getUsageMemberIdentities(parsed)) {
        const firstIndex = firstIndexByIdentity.get(identity);
        if (firstIndex === undefined) {
          firstIndexByIdentity.set(identity, index);
          continue;
        }
        parents[findRoot(index)] = findRoot(firstIndex);
      }
    });

    const groups = new Map<number, T[]>();
    parsedMembers.forEach((candidate, index) => {
      const root = findRoot(index);
      groups.set(root, [...(groups.get(root) ?? []), candidate]);
    });

    return Array.from(groups.values()).map((group): [T, ...T[]] => {
      const [first, ...duplicates] = group;
      if (first === undefined) {
        throw new RedisProblem(
          "ZRANGEBYSCORE",
          "Stored usage reconciliation produced an empty group",
        );
      }
      for (const candidate of duplicates) {
        if (first.parsed.value !== candidate.parsed.value || first.score !== candidate.score) {
          throw new RedisProblem(
            "ZRANGEBYSCORE",
            `Conflicting stored usage record '${candidate.parsed.id}' across Redis partitions`,
          );
        }
      }
      return [first, ...duplicates];
    });
  }

  private getUsageMemberIdentities(usage: Pick<UsageRecord, "id"> & UsageMemberEnvelope): string[] {
    return [
      `id:${usage.id}`,
      `idempotency:${usage.idempotencyKey ?? usage.id}`,
      ...(usage.eventId === undefined ? [] : [`event:${usage.eventId}`]),
    ];
  }

  private getUsageMemberRichness(usage: UsageMemberEnvelope): number {
    return Number(usage.idempotencyKey !== undefined) + Number(usage.eventId !== undefined);
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

    if (recordedResult.expiresAt > now && recordedResult.recorded) {
      return {
        exceeded: recordedResult.exceeded,
        newUsage: recordedResult.newUsage,
      };
    }

    if (recordedResult.expiresAt <= now) {
      this.recordedRecordKeys.delete(dedupeKey);
    }
    return undefined;
  }

  private rememberRecordIdempotencyKey(
    dedupeKey: string,
    result: AtomicQuotaCheckResult,
    recorded: boolean,
  ): void {
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
      recorded,
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
    try {
      const base = `${encodeURIComponent(usage.id)}:${usage.value}`;
      const envelope = {
        idempotencyKey: usage.idempotencyKey,
        eventId: usage.eventId,
        dimensions: usage.dimensions,
        metadata: usage.metadata,
      };

      const payload = stableStringify(envelope);
      parseUsageJson(payload, "SERIALIZE");
      return `${base}:v3.${encodeURIComponent(payload)}`;
    } catch (error) {
      throw this.toRedisProblem("SERIALIZE", error);
    }
  }

  private serializeLegacyUsageMember(
    usage: Pick<UsageRecord, "id" | "value" | "metadata">,
  ): string {
    const base = `${usage.id}:${usage.value}`;
    return usage.metadata === undefined
      ? base
      : `${base}:${encodeURIComponent(JSON.stringify(usage.metadata))}`;
  }

  private parseUsageMember(member: string): ParsedUsageMember {
    try {
      const parts = member.split(":");
      const rawId = parts[0] ?? "";
      const rawValue = parts[1] ?? "";
      const payload = parts[2];
      const versioned = payload?.startsWith("v2.") || payload?.startsWith("v3.");
      const encodedId = payload?.startsWith("v3.");
      const value = Number(rawValue);

      if (parts.length < 2 || parts.length > 3 || (!encodedId && rawId.length === 0)) {
        throw new RedisProblem("ZRANGEBYSCORE", "Invalid stored usage member boundaries");
      }
      const id = encodedId ? decodeURIComponent(rawId) : rawId;
      const envelope = versioned ? this.decodeUsageEnvelope(payload.slice(3)) : undefined;
      const metadata =
        payload !== undefined && !versioned ? this.decodeMetadata(payload) : undefined;

      if (!/^[1-9]\d*$/.test(rawValue) || !Number.isSafeInteger(value) || value > MAX_USAGE_VALUE) {
        throw new RedisProblem("ZRANGEBYSCORE", `Invalid stored usage value '${rawValue}'`);
      }

      return {
        id,
        value,
        idempotencyKey: envelope?.idempotencyKey,
        eventId: envelope?.eventId,
        dimensions: envelope?.dimensions,
        metadata: envelope?.metadata ?? metadata,
      };
    } catch (error) {
      throw this.toRedisProblem("ZRANGEBYSCORE", error);
    }
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

  private decodeMetadata(encodedMetadata: string): Record<string, unknown> {
    const parsed = parseUsageJson(decodeURIComponent(encodedMetadata), "ZRANGEBYSCORE");
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new RedisProblem("ZRANGEBYSCORE", "Invalid stored usage payload");
    }
    return parsed as Record<string, unknown>;
  }

  private decodeUsageEnvelope(encodedEnvelope: string): UsageMemberEnvelope {
    const parsed = this.decodeMetadata(encodedEnvelope);
    if (
      (parsed.idempotencyKey !== undefined && typeof parsed.idempotencyKey !== "string") ||
      (parsed.eventId !== undefined && typeof parsed.eventId !== "string")
    ) {
      throw new RedisProblem("ZRANGEBYSCORE", "Invalid stored usage identity");
    }
    return parsed as UsageMemberEnvelope;
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
    const candidateKeys = new Set(keys);
    const recordsByKey = new Map<string, UsageRecord[]>();
    for (const record of records) {
      const recordKeys =
        options.period === "billing_cycle"
          ? [
              this.buildUsageKey(
                options.tenantId,
                options.meterId,
                record.timestamp,
                "billing_cycle",
              ),
            ]
          : [
              this.buildUsageKey(
                options.tenantId,
                options.meterId,
                record.timestamp,
                options.period,
              ),
              this.buildUsageKey(
                options.tenantId,
                options.meterId,
                record.timestamp,
                "billing_cycle",
              ),
            ];
      for (const key of recordKeys) {
        if (candidateKeys.has(key)) {
          recordsByKey.set(key, [...(recordsByKey.get(key) ?? []), record]);
        }
      }
    }

    const membersByKey = new Map<string, Array<{ member: string; score: number }>>();
    const storedMembers: Array<{
      key: string;
      member: string;
      score: number;
      parsed: ParsedUsageMember;
    }> = [];
    for (const [key, keyRecords] of recordsByKey) {
      membersByKey.set(
        key,
        keyRecords.flatMap((record) => [
          { member: this.serializeUsageMember(record), score: record.timestamp.getTime() },
          { member: this.serializeLegacyUsageMember(record), score: record.timestamp.getTime() },
        ]),
      );
      const members = await this.runRedisOperation("ZRANGEBYSCORE", () =>
        this.redis.zrangebyscore(key, min, max, "WITHSCORES"),
      );
      for (const { member, score } of this.parseScoredUsageMembers(members)) {
        storedMembers.push({ key, member, score, parsed: this.parseUsageMember(member) });
      }
    }

    const requestedIdentities = new Set(
      records.flatMap((record) =>
        this.getUsageMemberIdentities(record).map((identity) =>
          JSON.stringify([identity, record.value, record.timestamp.getTime()]),
        ),
      ),
    );
    for (const group of this.groupUsageMembers(storedMembers)) {
      if (
        !group.some(({ parsed, score }) =>
          this.getUsageMemberIdentities(parsed).some((identity) =>
            requestedIdentities.has(JSON.stringify([identity, parsed.value, score])),
          ),
        )
      ) {
        continue;
      }
      for (const { key, member, score } of group) {
        const members = membersByKey.get(key);
        if (members === undefined) {
          throw new RedisProblem("ZREM", "Stored usage reconciliation found an unknown partition");
        }
        members.push({ member, score });
      }
    }
    for (const [key, members] of membersByKey) {
      const uniqueMembers = new Map(members.map((candidate) => [candidate.member, candidate]));
      membersByKey.set(key, [...uniqueMembers.values()]);
    }

    const script = `
local removed = 0
local usageKey = KEYS[1]
for index = 1, #ARGV, 2 do
  local member = ARGV[index]
  local expectedScore = ARGV[index + 1]
  local actualScore = redis.call('ZSCORE', usageKey, member)
  if actualScore and actualScore == expectedScore then
    removed = removed + redis.call('ZREM', usageKey, member)
  end
end
return removed
`;

    try {
      for (const [key, members] of membersByKey) {
        await this.redis.eval<[number]>(
          script,
          [key],
          members.flatMap(({ member, score }) => [member, score]),
        );
      }
    } catch (error) {
      throw this.toRedisProblem("ZREM", error);
    }
  }
}
