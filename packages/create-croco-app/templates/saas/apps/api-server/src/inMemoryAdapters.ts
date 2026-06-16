import type {
  AccessProvider,
  CheckRequest,
  CheckResult,
  GrantRequest,
  ListRequest,
  RelationTuple,
  RevokeRequest,
} from "@croco/access-core";
import type { DomainEvent, EventBus, EventSubscription } from "@croco/events-core";
import {
  MeterRepository,
  type AtomicQuotaCheckOptions,
  type AtomicQuotaCheckResult,
  type MeterDefinition,
  type MeterRegistrationOptions,
  type RedisClient,
  type UsageQueryOptions,
  type UsageRecord,
  type UsageStorage,
} from "@croco/metering-core";
import type { Tenant, TenantFilter, TenantSettings, TenantStore } from "@croco/tenant-core";
import type { TxAdapter } from "@croco/tx-core";

function createTenantId(slug: string): string {
  return `tenant_${slug.replace(/[^a-z0-9_-]/g, "_")}`;
}

function relationKey(tenantId: string, tuple: RelationTuple): string {
  return `${tenantId}:${tuple.object}:${tuple.relation}:${tuple.subject}`;
}

function isWithinRange(record: UsageRecord, options: UsageQueryOptions): boolean {
  if (record.tenantId !== options.tenantId || record.meterId !== options.meterId) {
    return false;
  }
  if (options.startDate && record.timestamp < options.startDate) {
    return false;
  }
  if (options.endDate && record.timestamp > options.endDate) {
    return false;
  }
  return true;
}

export class InMemoryTenantStore implements TenantStore {
  private readonly tenants = new Map<string, Tenant>();

  async findById(id: string): Promise<Tenant | null> {
    return this.tenants.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return [...this.tenants.values()].find((tenant) => tenant.slug === slug) ?? null;
  }

  async findAll(filter: TenantFilter = {}): Promise<Tenant[]> {
    return [...this.tenants.values()].filter((tenant) => {
      if (filter.status && tenant.status !== filter.status) return false;
      if (filter.slug && tenant.slug !== filter.slug) return false;
      if (filter.search && !tenant.name.toLowerCase().includes(filter.search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }

  async create(data: Omit<Tenant, "id" | "createdAt" | "updatedAt">): Promise<Tenant> {
    const now = new Date();
    const tenant = {
      ...data,
      id: createTenantId(data.slug),
      createdAt: now,
      updatedAt: now,
    };

    this.tenants.set(tenant.id, tenant);
    return tenant;
  }

  async update(
    id: string,
    data: Partial<Omit<Tenant, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Tenant> {
    const previous = await this.findById(id);
    if (!previous) throw new Error(`Tenant ${id} not found`);

    const tenant = {
      ...previous,
      ...data,
      updatedAt: new Date(),
    };

    this.tenants.set(id, tenant);
    return tenant;
  }

  async delete(id: string): Promise<boolean> {
    return this.tenants.delete(id);
  }

  async updateSettings(id: string, settings: Partial<TenantSettings>): Promise<Tenant> {
    const previous = await this.findById(id);
    if (!previous) throw new Error(`Tenant ${id} not found`);

    return this.update(id, {
      settings: {
        ...previous.settings,
        ...settings,
      },
    });
  }

  async exists(id: string): Promise<boolean> {
    return this.tenants.has(id);
  }
}

export class InMemoryAccessProvider implements AccessProvider {
  private readonly tuples = new Map<string, RelationTuple>();

  async check(request: CheckRequest): Promise<CheckResult> {
    return {
      allowed: this.tuples.has(
        relationKey(request.tenantId, {
          object: request.object,
          relation: request.relation,
          subject: request.subject,
        }),
      ),
    };
  }

  async grant(request: GrantRequest): Promise<void> {
    this.tuples.set(relationKey(request.tenantId, request.tuple), request.tuple);
  }

  async revoke(request: RevokeRequest): Promise<void> {
    this.tuples.delete(relationKey(request.tenantId, request.tuple));
  }

  async list(request: ListRequest): Promise<RelationTuple[]> {
    return [...this.tuples.entries()]
      .filter(([key, tuple]) => {
        if (!key.startsWith(`${request.tenantId}:`)) return false;
        if (request.object && tuple.object !== request.object) return false;
        if (request.relation && tuple.relation !== request.relation) return false;
        if (request.subject && tuple.subject !== request.subject) return false;
        return true;
      })
      .map(([, tuple]) => tuple);
  }
}

export class InMemoryMeterRepository extends MeterRepository {
  private readonly meters = new Map<string, MeterDefinition>();
  private readonly usageRecords: UsageRecord[] = [];

  async findByMeterIdAndTenant(meterId: string, tenantId: string): Promise<MeterDefinition | null> {
    return this.meters.get(`${tenantId}:${meterId}`) ?? null;
  }

  async save(meter: MeterRegistrationOptions): Promise<MeterDefinition> {
    const now = new Date();
    const definition = {
      ...meter,
      id: `${meter.tenantId}:${meter.meterId}`,
      createdAt: now,
      updatedAt: now,
    };

    this.meters.set(`${meter.tenantId}:${meter.meterId}`, definition);
    return definition;
  }

  async findAll(): Promise<MeterDefinition[]> {
    return [...this.meters.values()];
  }

  async findByTenant(tenantId: string): Promise<MeterDefinition[]> {
    return [...this.meters.values()].filter((meter) => meter.tenantId === tenantId);
  }

  async saveUsageRecords(records: UsageRecord[]): Promise<void> {
    this.usageRecords.push(...records);
  }
}

export class InMemoryUsageStorage implements UsageStorage {
  private readonly records: UsageRecord[] = [];
  private readonly idempotencyKeys = new Set<string>();

  async record(usage: UsageRecord): Promise<void> {
    this.records.push(usage);
  }

  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.records
      .filter((record) => isWithinRange(record, options))
      .reduce((total, record) => total + record.value, 0);
  }

  async isIdempotent(
    tenantId: string,
    meterId: string,
    idempotencyKey: string,
    _ttlSeconds: number,
  ): Promise<boolean> {
    const key = `${tenantId}:${meterId}:${idempotencyKey}`;
    if (this.idempotencyKeys.has(key)) {
      return false;
    }

    this.idempotencyKeys.add(key);
    return true;
  }

  async fetchUsageRecords(options: UsageQueryOptions): Promise<UsageRecord[]> {
    return this.records.filter((record) => isWithinRange(record, options));
  }

  async deleteUsageRecords(options: UsageQueryOptions, records: UsageRecord[]): Promise<void> {
    const deleteIds = new Set(records.map((record) => record.id));
    const keep = this.records.filter(
      (record) => !deleteIds.has(record.id) || !isWithinRange(record, options),
    );

    this.records.length = 0;
    this.records.push(...keep);
  }

  async checkAndRecordWithinQuota(
    options: AtomicQuotaCheckOptions,
  ): Promise<AtomicQuotaCheckResult> {
    const currentUsage = await this.getUsage({
      tenantId: options.tenantId,
      meterId: options.meterId,
      period: "billing_cycle",
    });
    const newUsage = currentUsage + options.value;
    const exceeded = newUsage > options.quota;

    if (!exceeded || options.allowOverQuota) {
      await this.record(options.usageRecord);
    }

    return { exceeded, newUsage };
  }

  async resetBillingCycle(tenantId: string, meterId?: string): Promise<void> {
    const keep = this.records.filter(
      (record) =>
        record.tenantId !== tenantId || (meterId !== undefined && record.meterId !== meterId),
    );

    this.records.length = 0;
    this.records.push(...keep);
  }
}

export class InMemoryRedisClient implements RedisClient {
  private readonly values = new Map<string, string>();
  private readonly sortedSets = new Map<string, Array<{ score: number; member: string }>>();

  async zadd(key: string, score: number, member: string): Promise<number> {
    const values = this.sortedSets.get(key) ?? [];
    values.push({ score, member });
    this.sortedSets.set(key, values);
    return 1;
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number,
    withScores?: "WITHSCORES",
  ): Promise<string[]> {
    const values = (this.sortedSets.get(key) ?? []).filter(
      (entry) => entry.score >= min && entry.score <= max,
    );

    if (withScores === "WITHSCORES") {
      return values.flatMap((entry) => [entry.member, String(entry.score)]);
    }

    return values.map((entry) => entry.member);
  }

  async set(
    key: string,
    value: string,
    _mode: "NX",
    _expireMode: "EX",
    _expire: number,
  ): Promise<string | null> {
    if (this.values.has(key)) {
      return null;
    }

    this.values.set(key, value);
    return "OK";
  }

  async eval<TResult extends unknown[]>(
    script: string,
    keys: string[],
    args: Array<string | number>,
  ): Promise<TResult> {
    const key = keys[0];

    if (script.includes("EXISTS")) {
      if (this.values.has(key)) {
        return [0] as TResult;
      }

      this.values.set(key, String(args[0]));
      return [1] as TResult;
    }

    if (script.includes("GET") && script.includes("SET")) {
      if (this.values.get(key) === String(args[0])) {
        this.values.set(key, String(args[1]));
      }
      return [1] as TResult;
    }

    if (script.includes("GET") && script.includes("DEL")) {
      if (this.values.get(key) === String(args[0])) {
        this.values.delete(key);
      }
      return [1] as TResult;
    }

    return [1] as TResult;
  }
}

export class InMemoryEventBus implements EventBus {
  readonly published: DomainEvent[] = [];
  private readonly subscriptions = new Set<EventSubscription>();

  async publish(event: DomainEvent): Promise<void> {
    this.published.push(event);
  }

  subscribe(subscription: EventSubscription): void {
    this.subscriptions.add(subscription);
  }

  unsubscribe(subscription: EventSubscription): void {
    this.subscriptions.delete(subscription);
  }

  clear(): void {
    this.published.length = 0;
    this.subscriptions.clear();
  }
}

export class NoopTxAdapter implements TxAdapter<unknown> {
  async transaction<T>(fn: (client: unknown) => Promise<T>): Promise<T> {
    return fn({});
  }

  async savepoint<T>(_client: unknown, fn: (client: unknown) => Promise<T>): Promise<T> {
    return fn({});
  }

  supportsSavepoint(): boolean {
    return true;
  }
}
