import {
  IdempotencyManager,
  type MeterDefinition,
  MeteringService,
  type MeterRegistrationOptions,
  MeterRegistry,
  MeterRepository,
  type UsageQueryOptions,
  type UsageRecord,
  type UsageStorage,
} from "@croco/metering-core";

class InMemoryUsageStorage implements UsageStorage {
  private records: UsageRecord[] = [];
  private readonly idempotencyKeys = new Set<string>();

  async record(usage: UsageRecord): Promise<void> {
    this.records = [...this.records, usage];
    console.log("usage recorded", usage);
  }

  async getUsage(options: UsageQueryOptions): Promise<number> {
    return this.filterRecords(options).reduce((total, record) => total + record.value, 0);
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
    return this.filterRecords(options);
  }

  private filterRecords(options: UsageQueryOptions): UsageRecord[] {
    return this.records.filter((record) => {
      const startsAfter = !options.startDate || record.timestamp >= options.startDate;
      const endsBefore = !options.endDate || record.timestamp <= options.endDate;
      return (
        record.tenantId === options.tenantId &&
        record.meterId === options.meterId &&
        startsAfter &&
        endsBefore
      );
    });
  }
}

class InMemoryMeterRepository extends MeterRepository {
  private meters: MeterDefinition[] = [
    {
      id: "meter-api-user-create",
      tenantId: "default",
      meterId: "api_user_create",
      type: "COUNT",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ];

  async findByMeterIdAndTenant(meterId: string, tenantId: string): Promise<MeterDefinition | null> {
    return (
      this.meters.find((meter) => meter.meterId === meterId && meter.tenantId === tenantId) ?? null
    );
  }

  async save(meter: MeterRegistrationOptions): Promise<MeterDefinition> {
    const saved = {
      id: `meter-${this.meters.length + 1}`,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...meter,
    };
    this.meters = [...this.meters, saved];
    return saved;
  }

  async findAll(): Promise<MeterDefinition[]> {
    return [...this.meters];
  }

  async findByTenant(tenantId: string): Promise<MeterDefinition[]> {
    return this.meters.filter((meter) => meter.tenantId === tenantId);
  }

  async saveUsageRecords(records: UsageRecord[]): Promise<void> {
    console.log("usage records saved", records);
  }
}

export function createMeteringService(): MeteringService {
  const usageStorage = new InMemoryUsageStorage();
  const meterRegistry = new MeterRegistry(new InMemoryMeterRepository());
  const idempotencyManager = new IdempotencyManager({
    async zadd() {
      return 1;
    },
    async zrangebyscore() {
      return [];
    },
    async set() {
      return "OK";
    },
    async eval<TResult extends unknown[]>() {
      return [1] as TResult;
    },
  });

  return new MeteringService({
    meterRegistry,
    usageStorage,
    idempotencyManager,
  });
}
