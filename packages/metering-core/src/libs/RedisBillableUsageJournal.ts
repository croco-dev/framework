import { MeteringTransitionProblem } from "./problems/MeteringTransitionProblem";
import { RedisProblem } from "./problems/RedisProblem";
import { buildMeteringRedisKey, encodeRedisKeySegment } from "./redisKey";
import type {
  BillableUsageAppendResult,
  BillableUsageClaim,
  BillableUsageClaimOptions,
  BillableUsageEvent,
  BillableUsageFailure,
  BillableUsageJournal,
  BillableUsageJournalDiagnostics,
  BillableUsageJournalEntry,
} from "./BillableUsageJournal";
import type { RedisClient } from "./RedisClient";

type StoredEntry = Omit<
  BillableUsageJournalEntry,
  | "acceptedAt"
  | "createdAt"
  | "deliverableAt"
  | "event"
  | "leaseExpiresAt"
  | "retryAt"
  | "updatedAt"
> & {
  readonly acceptedAt?: string | number;
  readonly createdAt: string | number;
  readonly deliverableAt?: string | number;
  readonly eventJson: string;
  readonly eventFingerprint: string;
  readonly leaseExpiresAt?: string | number;
  readonly retryAt?: string | number;
  readonly updatedAt: string | number;
};

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

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
        compareKeys(left, right),
      ),
    );
  });
}

/** Redis-backed durable billable usage journal with atomic Lua transitions and fenced leases. */
export class RedisBillableUsageJournal implements BillableUsageJournal {
  readonly durability = "persistent" as const;

  private static readonly APPEND_SCRIPT = `
local existing = redis.call('GET', KEYS[1])
if existing then
  local decoded = cjson.decode(existing)
  if decoded.eventFingerprint ~= ARGV[1] then
    return { -1, existing }
  end
  return { 0, existing }
end
local redisTime = redis.call('TIME')
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local entry = cjson.decode(ARGV[2])
entry.createdAt = nowMs
entry.createdAtEpochMs = nowMs
entry.updatedAt = nowMs
local stored = cjson.encode(entry)
redis.call('SET', KEYS[1], stored)
redis.call('ZADD', KEYS[2], nowMs, ARGV[3])
return { 1, stored }
`;

  private static readonly FINALIZE_PENDING_SCRIPT = `
local entryJson = redis.call('GET', KEYS[1])
if not entryJson then return { 0, 'MISSING', '' } end
local entry = cjson.decode(entryJson)
if entry.state ~= 'pending' then return { 0, 'STATUS:' .. tostring(entry.state), entryJson } end

local redisTime = redis.call('TIME')
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
entry.updatedAt = nowMs
if ARGV[1] == 'deliverable' then
  entry.deliverableAt = nowMs
else
  entry.state = 'terminal-failed'
  entry.failure = cjson.decode(ARGV[3])
end
local updated = cjson.encode(entry)
redis.call('SET', KEYS[1], updated)
if ARGV[1] == 'deliverable' then
  redis.call('ZADD', KEYS[2], nowMs, ARGV[2])
else
  redis.call('ZREM', KEYS[2], ARGV[2])
  redis.call('ZREM', KEYS[3], ARGV[2])
  redis.call('INCR', KEYS[4])
end
return { 1, 'OK', updated }
`;

  private static readonly CLAIM_SCRIPT = `
local redisTime = redis.call('TIME')
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local candidates = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', nowMs, 'LIMIT', 0, 100)
for _, eventId in ipairs(candidates) do
  local entryKey = ARGV[3] .. eventId
  local entryJson = redis.call('GET', entryKey)
  if entryJson then
    local entry = cjson.decode(entryJson)
    local claimable = entry.state == 'pending'
      or (entry.state == 'retryable-failed' and (not entry.retryAt or tonumber(entry.retryAt) <= nowMs))
      or (entry.state == 'delivering' and entry.leaseExpiresAt and tonumber(entry.leaseExpiresAt) <= nowMs)
    if claimable then
      local fencingToken = redis.call('INCR', KEYS[2])
      local leaseExpiresAt = nowMs + tonumber(ARGV[2])
      entry.state = 'delivering'
      entry.ownerId = ARGV[1]
      entry.fencingToken = fencingToken
      entry.leaseExpiresAt = leaseExpiresAt
      entry.retryAt = nil
      entry.updatedAt = nowMs
      local updated = cjson.encode(entry)
      redis.call('SET', entryKey, updated)
      redis.call('ZADD', KEYS[1], leaseExpiresAt, eventId)
      return { updated }
    end
  else
    redis.call('ZREM', KEYS[1], eventId)
  end
end
return { '' }
`;

  private static readonly TRANSITION_SCRIPT = `
local entryJson = redis.call('GET', KEYS[1])
if not entryJson then return { 0, 'MISSING', '' } end
local entry = cjson.decode(entryJson)
if entry.state ~= 'delivering' then return { 0, 'STATUS:' .. tostring(entry.state), entryJson } end
if entry.ownerId ~= ARGV[1] then return { 0, 'OWNER', entryJson } end
if tonumber(entry.fencingToken) ~= tonumber(ARGV[2]) then return { 0, 'FENCE', entryJson } end
local redisTime = redis.call('TIME')
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
if not entry.leaseExpiresAt or tonumber(entry.leaseExpiresAt) <= nowMs then return { 0, 'LEASE_EXPIRED', entryJson } end

entry.state = ARGV[3]
entry.updatedAt = nowMs
entry.ownerId = nil
entry.fencingToken = nil
entry.leaseExpiresAt = nil

if ARGV[3] == 'accepted' then
  entry.acceptedAt = nowMs
  entry.retryAt = nil
  entry.failure = nil
elseif ARGV[3] == 'retryable-failed' then
  entry.retryCount = tonumber(entry.retryCount or 0) + 1
  entry.failure = cjson.decode(ARGV[5])
  entry.retryAt = tonumber(ARGV[6])
elseif ARGV[3] == 'terminal-failed' then
  entry.failure = cjson.decode(ARGV[5])
  entry.retryAt = nil
end

local updated = cjson.encode(entry)
redis.call('SET', KEYS[1], updated)
if ARGV[3] == 'accepted' then
  redis.call('ZREM', KEYS[2], ARGV[4])
  redis.call('ZREM', KEYS[3], ARGV[4])
elseif ARGV[3] == 'retryable-failed' then
  redis.call('ZADD', KEYS[2], tonumber(ARGV[6]), ARGV[4])
  redis.call('INCR', KEYS[4])
elseif ARGV[3] == 'terminal-failed' then
  redis.call('ZREM', KEYS[2], ARGV[4])
  redis.call('ZREM', KEYS[3], ARGV[4])
  redis.call('INCR', KEYS[5])
end
return { 1, 'OK', updated }
`;

  private static readonly GET_SCRIPT = `
return { redis.call('GET', KEYS[1]) or '' }
`;

  private static readonly DIAGNOSTICS_SCRIPT = `
local redisTime = redis.call('TIME')
local nowMs = tonumber(redisTime[1]) * 1000 + math.floor(tonumber(redisTime[2]) / 1000)
local oldest = redis.call('ZRANGE', KEYS[1], 0, 0, 'WITHSCORES')
local oldestAge = -1
if oldest[2] then oldestAge = math.max(0, nowMs - tonumber(oldest[2])) end
return {
  redis.call('ZCARD', KEYS[1]),
  oldestAge,
  tonumber(redis.call('GET', KEYS[2]) or '0'),
  tonumber(redis.call('GET', KEYS[3]) or '0')
}
`;

  private readonly pendingKey = buildMeteringRedisKey("billable-journal", ["pending"]);
  private readonly backlogKey = buildMeteringRedisKey("billable-journal", ["backlog"]);
  private readonly fencingKey = buildMeteringRedisKey("billable-journal", ["fencing"]);
  private readonly retryCountKey = buildMeteringRedisKey("billable-journal", ["retry-count"]);
  private readonly terminalCountKey = buildMeteringRedisKey("billable-journal", ["terminal-count"]);
  private readonly entryKeyPrefix = `${buildMeteringRedisKey("billable-journal", ["event"])}:`;

  constructor(private readonly redis: RedisClient) {}

  async append(event: BillableUsageEvent, now = new Date()): Promise<BillableUsageAppendResult> {
    const normalizedEvent: BillableUsageEvent = {
      ...event,
      dimensions: Object.fromEntries(
        Object.entries(event.dimensions).sort(([left], [right]) => compareKeys(left, right)),
      ),
    };
    const eventJson = stableStringify(normalizedEvent);
    const eventFingerprint = eventJson;
    const stored: StoredEntry & { readonly createdAtEpochMs: number } = {
      eventJson,
      eventFingerprint,
      state: "pending",
      createdAt: now.toISOString(),
      createdAtEpochMs: now.getTime(),
      updatedAt: now.toISOString(),
      retryCount: 0,
    };
    const [result, entryJson] = await this.runRedisOperation("append billable usage", () =>
      this.redis.eval<[number, string]>(
        RedisBillableUsageJournal.APPEND_SCRIPT,
        [this.entryKey(event.eventId), this.backlogKey],
        [eventFingerprint, JSON.stringify(stored), encodeRedisKeySegment(event.eventId)],
      ),
    );
    if (result === -1) {
      throw new MeteringTransitionProblem("append-billable-usage", "EVENT_CONFLICT", event.eventId);
    }
    return { outcome: result === 0 ? "duplicate" : "appended", entry: this.parseEntry(entryJson) };
  }

  async claimNext(options: BillableUsageClaimOptions): Promise<BillableUsageClaim | null> {
    if (!Number.isFinite(options.leaseDurationMs) || options.leaseDurationMs <= 0) {
      throw new MeteringTransitionProblem("claim-billable-usage", "INVALID_LEASE", options.ownerId);
    }
    const [entryJson] = await this.runRedisOperation("claim billable usage", () =>
      this.redis.eval<[string]>(
        RedisBillableUsageJournal.CLAIM_SCRIPT,
        [this.pendingKey, this.fencingKey],
        [options.ownerId, options.leaseDurationMs, this.entryKeyPrefix],
      ),
    );
    return entryJson ? (this.parseEntry(entryJson) as BillableUsageClaim) : null;
  }

  async markDeliverable(eventId: string, _now = new Date()): Promise<BillableUsageJournalEntry> {
    return this.finalizePending(eventId, "deliverable", undefined);
  }

  async markUndeliverable(
    eventId: string,
    failure: BillableUsageFailure,
    _now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    return this.finalizePending(eventId, "terminal-failed", failure);
  }

  async markAccepted(
    claim: BillableUsageClaim,
    _now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    return this.transition(claim, "accepted", undefined, undefined);
  }

  async markRetryableFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    retryAt: Date,
    _now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    return this.transition(claim, "retryable-failed", failure, retryAt);
  }

  async markTerminalFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    _now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    return this.transition(claim, "terminal-failed", failure, undefined);
  }

  async get(eventId: string): Promise<BillableUsageJournalEntry | null> {
    const [entryJson] = await this.runRedisOperation("get billable usage", () =>
      this.redis.eval<[string]>(RedisBillableUsageJournal.GET_SCRIPT, [this.entryKey(eventId)], []),
    );
    return entryJson ? this.parseEntry(entryJson) : null;
  }

  async getDiagnostics(_now = new Date()): Promise<BillableUsageJournalDiagnostics> {
    const [backlogCount, oldestPendingAgeMs, retryCount, terminalFailureCount] =
      await this.runRedisOperation("inspect billable usage journal", () =>
        this.redis.eval<[number, number, number, number]>(
          RedisBillableUsageJournal.DIAGNOSTICS_SCRIPT,
          [this.backlogKey, this.retryCountKey, this.terminalCountKey],
          [],
        ),
      );
    return {
      backlogCount,
      oldestPendingAgeMs: oldestPendingAgeMs < 0 ? null : oldestPendingAgeMs,
      retryCount,
      terminalFailureCount,
    };
  }

  private async transition(
    claim: BillableUsageClaim,
    state: "accepted" | "retryable-failed" | "terminal-failed",
    failure: BillableUsageFailure | undefined,
    retryAt: Date | undefined,
  ): Promise<BillableUsageJournalEntry> {
    const [transitioned, reason, entryJson] = await this.runRedisOperation(
      `mark billable usage ${state}`,
      () =>
        this.redis.eval<[number, string, string]>(
          RedisBillableUsageJournal.TRANSITION_SCRIPT,
          [
            this.entryKey(claim.event.eventId),
            this.pendingKey,
            this.backlogKey,
            this.retryCountKey,
            this.terminalCountKey,
          ],
          [
            claim.ownerId,
            claim.fencingToken,
            state,
            encodeRedisKeySegment(claim.event.eventId),
            JSON.stringify(failure ?? {}),
            retryAt?.getTime() ?? 0,
          ],
        ),
    );
    if (transitioned !== 1) {
      throw new MeteringTransitionProblem(
        `mark-billable-usage-${state}`,
        reason,
        claim.event.eventId,
      );
    }
    return this.parseEntry(entryJson);
  }

  private async finalizePending(
    eventId: string,
    outcome: "deliverable" | "terminal-failed",
    failure: BillableUsageFailure | undefined,
  ): Promise<BillableUsageJournalEntry> {
    const [transitioned, reason, entryJson] = await this.runRedisOperation(
      `finalize pending billable usage ${outcome}`,
      () =>
        this.redis.eval<[number, string, string]>(
          RedisBillableUsageJournal.FINALIZE_PENDING_SCRIPT,
          [this.entryKey(eventId), this.pendingKey, this.backlogKey, this.terminalCountKey],
          [outcome, encodeRedisKeySegment(eventId), JSON.stringify(failure ?? {})],
        ),
    );
    if (transitioned !== 1) {
      throw new MeteringTransitionProblem(`finalize-billable-usage-${outcome}`, reason, eventId);
    }
    return this.parseEntry(entryJson);
  }

  private entryKey(eventId: string): string {
    return `${this.entryKeyPrefix}${encodeRedisKeySegment(eventId)}`;
  }

  private parseEntry(serialized: string): BillableUsageJournalEntry {
    const stored = JSON.parse(serialized) as StoredEntry & { readonly createdAtEpochMs?: number };
    return {
      event: JSON.parse(stored.eventJson) as BillableUsageEvent,
      state: stored.state,
      createdAt: new Date(stored.createdAt),
      updatedAt: new Date(stored.updatedAt),
      retryCount: stored.retryCount,
      ownerId: stored.ownerId,
      fencingToken: stored.fencingToken,
      failure: stored.failure,
      deliverableAt: stored.deliverableAt ? new Date(stored.deliverableAt) : undefined,
      acceptedAt: stored.acceptedAt ? new Date(stored.acceptedAt) : undefined,
      leaseExpiresAt: stored.leaseExpiresAt ? new Date(stored.leaseExpiresAt) : undefined,
      retryAt: stored.retryAt ? new Date(stored.retryAt) : undefined,
    };
  }

  private async runRedisOperation<T>(operation: string, command: () => Promise<T>): Promise<T> {
    try {
      return await command();
    } catch (error) {
      if (error instanceof MeteringTransitionProblem || error instanceof RedisProblem) {
        throw error;
      }
      throw new RedisProblem(
        operation,
        error instanceof Error || typeof error === "string" ? error : undefined,
      );
    }
  }
}
