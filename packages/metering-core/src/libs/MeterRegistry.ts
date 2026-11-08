import { Component } from "@croco/framework-context";
import type { BillableUsageJournal } from "./BillableUsageJournal";
import type { MeterRepository } from "./MeterRepository";
import { BillableUsageJournalRequiredProblem } from "./problems/BillableUsageJournalRequiredProblem";
import { InvalidMeterProblem } from "./problems/InvalidMeterProblem";
import { snapshotMeterMetadata } from "./meterMetadata";
import { InvalidMeterMetadataProblem } from "./problems/InvalidMeterMetadataProblem";
import { InvalidStoredMeterMetadataProblem } from "./problems/InvalidStoredMeterMetadataProblem";
import type { MeterDefinition, MeterRegistrationOptions } from "./types";

// Keep declared fields materialized even when a repository uses getters or non-enumerable properties.
const METER_DEFINITION_FIELDS = {
  id: true,
  tenantId: true,
  meterId: true,
  type: true,
  billing: true,
  aggregation: true,
  unit: true,
  quota: true,
  allowOverQuota: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Record<keyof MeterDefinition, true>;

/**
 * Meter 정의 레지스트리
 *
 * @description
 * DB에서 Meter 정의를 로드하고 메모리 캐싱합니다.
 * - 앱 시작 시 모든 Meter 로드
 * - 런타임에 새 Meter 등록 가능
 * - 테넌트별 격리된 조회
 */
@Component()
export class MeterRegistry {
  private static readonly DEFAULT_CACHE_TTL_MS = 60_000;

  /**
   * 캐시: Map<tenantId, Map<meterId, MeterDefinition>>
   */
  private readonly cache = new Map<string, Map<string, MeterDefinition>>();
  private readonly cacheUpdatedAt = new Map<string, number>();
  private readonly tenantSnapshotUpdatedAt = new Map<string, number>();
  private readonly tenantCacheVersions = new Map<string, number>();
  private cacheGeneration = 0;

  constructor(
    private readonly repository: MeterRepository,
    private readonly cacheTtlMs: number = MeterRegistry.DEFAULT_CACHE_TTL_MS,
    readonly billableUsageJournal?: BillableUsageJournal,
  ) {}

  /**
   * 앱 시작 시 모든 Meter 로드
   */
  async loadAll(): Promise<void> {
    const meters = (await this.repository.findAll()).map((meter) => {
      const snapshot = this.snapshotDefinition(meter);
      this.assertJournalConfigured(snapshot);
      return snapshot;
    });
    this.clearCache();

    for (const meter of meters) {
      this.addToCache(meter);
    }
    const updatedAt = Date.now();
    for (const tenantId of this.cache.keys()) {
      this.tenantSnapshotUpdatedAt.set(tenantId, updatedAt);
    }
  }

  /**
   * Meter 조회 (캐시 우선)
   * @returns MeterDefinition 또는 null
   */
  async get(tenantId: string, meterId: string): Promise<MeterDefinition | null> {
    // 캐시에서 먼저 확인
    if (this.isCacheStale(tenantId)) {
      await this.refreshTenantCache(tenantId);
    }

    const cached = this.getFromCache(tenantId, meterId);
    if (cached) {
      return structuredClone(cached);
    }

    // 캐시에 없으면 DB 조회
    const meter = await this.repository.findByMeterIdAndTenant(meterId, tenantId);
    if (meter) return structuredClone(this.addToCache(meter));

    return null;
  }

  /**
   * Meter 조회 (없으면 throw)
   * @throws InvalidMeterProblem
   */
  async getOrThrow(tenantId: string, meterId: string): Promise<MeterDefinition> {
    const meter = await this.get(tenantId, meterId);
    if (!meter) {
      throw new InvalidMeterProblem(meterId, tenantId);
    }
    return meter;
  }

  /**
   * 새 Meter 등록
   */
  async register(options: MeterRegistrationOptions): Promise<MeterDefinition> {
    const submitted = this.snapshotDefinition(options, "registration");
    this.assertJournalConfigured(submitted);
    const meter = await this.repository.save(submitted);
    return structuredClone(this.addToCache(meter));
  }

  /**
   * 테넌트별 모든 Meter 조회
   */
  async getByTenant(tenantId: string): Promise<MeterDefinition[]> {
    const tenantCache = this.cache.get(tenantId);
    const snapshotUpdatedAt = this.tenantSnapshotUpdatedAt.get(tenantId);
    if (
      tenantCache &&
      snapshotUpdatedAt !== undefined &&
      Date.now() - snapshotUpdatedAt < this.cacheTtlMs
    ) {
      return structuredClone(Array.from(tenantCache.values()));
    }

    return this.refreshTenantCache(tenantId);
  }

  /**
   * 캐시 초기화 (테스트용)
   */
  clearCache(): void {
    this.cacheGeneration += 1;
    this.cache.clear();
    this.cacheUpdatedAt.clear();
    this.tenantSnapshotUpdatedAt.clear();
    this.tenantCacheVersions.clear();
  }

  getCachedBillingRequirement(tenantId: string, meterId: string): "local" | "required" | "unknown" {
    if (this.isCacheStale(tenantId)) {
      return "unknown";
    }
    const meter = this.getFromCache(tenantId, meterId);
    if (!meter) {
      return "unknown";
    }
    return meter.billing === "required" ? "required" : "local";
  }

  private addToCache(meter: MeterDefinition): MeterDefinition {
    const snapshot = this.snapshotDefinition(meter);
    this.assertJournalConfigured(snapshot);
    let tenantCache = this.cache.get(snapshot.tenantId);
    if (!tenantCache) {
      tenantCache = new Map();
      this.cache.set(snapshot.tenantId, tenantCache);
    }
    tenantCache.set(snapshot.meterId, snapshot);
    this.tenantCacheVersions.set(
      snapshot.tenantId,
      (this.tenantCacheVersions.get(snapshot.tenantId) ?? 0) + 1,
    );
    this.cacheUpdatedAt.set(snapshot.tenantId, Date.now());
    return snapshot;
  }

  private getFromCache(tenantId: string, meterId: string): MeterDefinition | null {
    return this.cache.get(tenantId)?.get(meterId) ?? null;
  }

  private async refreshTenantCache(tenantId: string): Promise<MeterDefinition[]> {
    const generation = this.cacheGeneration;
    const version = this.tenantCacheVersions.get(tenantId) ?? 0;
    const superseded = () =>
      generation !== this.cacheGeneration ||
      version !== (this.tenantCacheVersions.get(tenantId) ?? 0);
    const meters = await this.repository.findByTenant(tenantId);
    if (superseded()) {
      return structuredClone(Array.from(this.cache.get(tenantId)?.values() ?? []));
    }
    const snapshots = meters.map((meter) => {
      const snapshot = this.snapshotDefinition(meter);
      this.assertJournalConfigured(snapshot);
      return snapshot;
    });
    // Repository getters may clear or replace the cache while their fields are materialized.
    if (superseded()) return structuredClone(Array.from(this.cache.get(tenantId)?.values() ?? []));
    const tenantCache = new Map(snapshots.map((meter) => [meter.meterId, meter]));

    this.cache.set(tenantId, tenantCache);
    this.tenantCacheVersions.set(tenantId, version + 1);
    const updatedAt = Date.now();
    this.cacheUpdatedAt.set(tenantId, updatedAt);
    this.tenantSnapshotUpdatedAt.set(tenantId, updatedAt);

    return structuredClone(snapshots);
  }

  private snapshotDefinition<T extends MeterRegistrationOptions>(
    meter: T,
    source: "registration" | "repository" = "repository",
  ): T {
    try {
      const definition: Record<string, unknown> = {};
      const keys = new Set([...Object.keys(meter), ...Object.keys(METER_DEFINITION_FIELDS)]);
      for (const key of keys) {
        if (!(key in meter)) continue;
        Object.defineProperty(definition, key, {
          value: Reflect.get(meter, key),
          enumerable: true,
          configurable: true,
          writable: true,
        });
      }
      const hadMetadata = Object.hasOwn(definition, "metadata");
      const metadata = definition.metadata;
      delete definition.metadata;
      const snapshot = structuredClone(definition) as T;
      if (metadata !== undefined) snapshot.metadata = snapshotMeterMetadata(metadata, snapshot);
      else if (hadMetadata) snapshot.metadata = undefined;
      return snapshot;
    } catch (error) {
      const invalid =
        error instanceof InvalidMeterMetadataProblem
          ? error
          : new InvalidMeterMetadataProblem(
              meter,
              "/metadata",
              "meter definition could not be copied",
            );
      if (source === "registration") throw invalid;
      throw new InvalidStoredMeterMetadataProblem(meter, invalid);
    }
  }

  private isCacheStale(tenantId: string): boolean {
    const updatedAt = this.cacheUpdatedAt.get(tenantId);
    if (updatedAt === undefined) {
      return false;
    }

    return Date.now() - updatedAt >= this.cacheTtlMs;
  }

  private assertJournalConfigured(meter: Pick<MeterDefinition, "billing" | "meterId">): void {
    if (meter.billing === "required" && this.billableUsageJournal?.durability !== "persistent") {
      throw new BillableUsageJournalRequiredProblem(meter.meterId);
    }
  }
}
