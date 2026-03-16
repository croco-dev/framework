import { Component } from '@croco/framework-context';
import type { MeterRepository } from './MeterRepository';
import { InvalidMeterProblem } from './problems/InvalidMeterProblem';
import type { MeterDefinition, MeterRegistrationOptions } from './types';

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

  constructor(
    private readonly repository: MeterRepository,
    private readonly cacheTtlMs: number = MeterRegistry.DEFAULT_CACHE_TTL_MS
  ) {}

  /**
   * 앱 시작 시 모든 Meter 로드
   */
  async loadAll(): Promise<void> {
    const meters = await this.repository.findAll();
    this.cache.clear();

    for (const meter of meters) {
      this.addToCache(meter);
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
      return cached;
    }

    // 캐시에 없으면 DB 조회
    const meter = await this.repository.findByMeterIdAndTenant(meterId, tenantId);
    if (meter) {
      this.addToCache(meter);
    }

    return meter;
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
    const meter = await this.repository.save(options);
    this.addToCache(meter);
    return meter;
  }

  /**
   * 테넌트별 모든 Meter 조회
   */
  async getByTenant(tenantId: string): Promise<MeterDefinition[]> {
    const tenantCache = this.cache.get(tenantId);
    if (tenantCache && tenantCache.size > 0 && !this.isCacheStale(tenantId)) {
      return Array.from(tenantCache.values());
    }

    return this.refreshTenantCache(tenantId);
  }

  /**
   * 캐시 초기화 (테스트용)
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheUpdatedAt.clear();
  }

  private addToCache(meter: MeterDefinition): void {
    let tenantCache = this.cache.get(meter.tenantId);
    if (!tenantCache) {
      tenantCache = new Map();
      this.cache.set(meter.tenantId, tenantCache);
    }
    tenantCache.set(meter.meterId, meter);
    this.cacheUpdatedAt.set(meter.tenantId, Date.now());
  }

  private getFromCache(tenantId: string, meterId: string): MeterDefinition | null {
    return this.cache.get(tenantId)?.get(meterId) ?? null;
  }

  private async refreshTenantCache(tenantId: string): Promise<MeterDefinition[]> {
    const meters = await this.repository.findByTenant(tenantId);
    const tenantCache = new Map<string, MeterDefinition>();

    for (const meter of meters) {
      tenantCache.set(meter.meterId, meter);
    }

    this.cache.set(tenantId, tenantCache);
    this.cacheUpdatedAt.set(tenantId, Date.now());

    return meters;
  }

  private isCacheStale(tenantId: string): boolean {
    const updatedAt = this.cacheUpdatedAt.get(tenantId);
    if (updatedAt === undefined) {
      return false;
    }

    return Date.now() - updatedAt >= this.cacheTtlMs;
  }
}
