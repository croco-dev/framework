type MetadataKey = symbol;
type MetadataTarget = object | ((...args: unknown[]) => unknown);
type MetadataPropertyKey = string | symbol;

const CLASS_METADATA = Symbol("class-metadata");

interface MetadataEntry {
  key: MetadataKey;
  target: MetadataTarget;
  propertyKey: string | symbol | undefined;
  value: unknown;
}

class MetadataStorageImpl {
  private static INSTANCE: MetadataStorageImpl;
  private readonly storage = new Map<
    MetadataKey,
    Map<MetadataTarget, Map<MetadataPropertyKey, MetadataEntry>>
  >();
  private readonly entries = new Set<MetadataEntry>();

  static getInstance(): MetadataStorageImpl {
    if (!MetadataStorageImpl.INSTANCE) {
      MetadataStorageImpl.INSTANCE = new MetadataStorageImpl();
    }
    return MetadataStorageImpl.INSTANCE;
  }

  private getPropertyKey(propertyKey?: string | symbol): MetadataPropertyKey {
    return propertyKey ?? CLASS_METADATA;
  }

  define<T>(
    key: MetadataKey,
    target: MetadataTarget,
    value: T,
    propertyKey?: string | symbol,
  ): void {
    let targetStorage = this.storage.get(key);
    if (targetStorage === undefined) {
      targetStorage = new Map();
      this.storage.set(key, targetStorage);
    }

    let propertyStorage = targetStorage.get(target);
    if (propertyStorage === undefined) {
      propertyStorage = new Map();
      targetStorage.set(target, propertyStorage);
    }

    const storedPropertyKey = this.getPropertyKey(propertyKey);
    const existingEntry = propertyStorage.get(storedPropertyKey);
    if (existingEntry !== undefined) {
      existingEntry.value = value;
      return;
    }

    const entry: MetadataEntry = { key, target, propertyKey, value };
    propertyStorage.set(storedPropertyKey, entry);
    this.entries.add(entry);
  }

  get<T>(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): T | undefined {
    return this.storage.get(key)?.get(target)?.get(this.getPropertyKey(propertyKey))?.value as
      | T
      | undefined;
  }

  getAll<T>(
    key: MetadataKey,
  ): Array<{ target: MetadataTarget; propertyKey?: string | symbol | undefined; value: T }> {
    const entries: MetadataEntry[] = [];
    for (const entry of this.entries) {
      if (entry.key === key) entries.push(entry);
    }
    return entries.map(({ target, propertyKey, value }) => ({
      target,
      propertyKey,
      value: value as T,
    }));
  }

  getAllForTarget<T>(
    key: MetadataKey,
    target: MetadataTarget,
  ): Array<{ propertyKey?: string | symbol | undefined; value: T }> {
    const entries: MetadataEntry[] = [];
    for (const entry of this.entries) {
      if (entry.key === key && entry.target === target) entries.push(entry);
    }
    return entries.map(({ propertyKey, value }) => ({ propertyKey, value: value as T }));
  }

  has(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    return this.storage.get(key)?.get(target)?.has(this.getPropertyKey(propertyKey)) ?? false;
  }

  delete(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    const targetStorage = this.storage.get(key);
    const propertyStorage = targetStorage?.get(target);
    const storedPropertyKey = this.getPropertyKey(propertyKey);
    const entry = propertyStorage?.get(storedPropertyKey);
    if (targetStorage === undefined || propertyStorage === undefined || entry === undefined) {
      return false;
    }

    propertyStorage.delete(storedPropertyKey);
    this.entries.delete(entry);

    if (propertyStorage.size === 0) targetStorage.delete(target);
    if (targetStorage.size === 0) this.storage.delete(key);

    return true;
  }

  clear(): void {
    this.storage.clear();
    this.entries.clear();
  }
}

/**
 * 심볼 키 기반 메타데이터를 저장하고 조회하는 싱글턴 저장소입니다.
 */
export const MetadataStorage = MetadataStorageImpl.getInstance();
