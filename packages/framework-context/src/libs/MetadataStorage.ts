type MetadataKey = symbol;
type MetadataTarget = object | ((...args: unknown[]) => unknown);

interface MetadataEntry {
  key: MetadataKey;
  target: MetadataTarget;
  propertyKey?: string | symbol;
  value: unknown;
}

class MetadataStorageImpl {
  private static INSTANCE: MetadataStorageImpl;
  private readonly storage: MetadataEntry[] = [];

  static getInstance(): MetadataStorageImpl {
    if (!MetadataStorageImpl.INSTANCE) {
      MetadataStorageImpl.INSTANCE = new MetadataStorageImpl();
    }
    return MetadataStorageImpl.INSTANCE;
  }

  define<T>(key: MetadataKey, target: MetadataTarget, value: T, propertyKey?: string | symbol): void {
    const existing = this.storage.findIndex(
      (entry) => entry.key === key && entry.target === target && entry.propertyKey === propertyKey
    );

    if (existing !== -1) {
      this.storage[existing].value = value;
    } else {
      this.storage.push({ key, target, propertyKey, value });
    }
  }

  get<T>(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): T | undefined {
    const entry = this.storage.find((e) => e.key === key && e.target === target && e.propertyKey === propertyKey);
    return entry?.value as T | undefined;
  }

  getAll<T>(key: MetadataKey): Array<{ target: MetadataTarget; propertyKey?: string | symbol; value: T }> {
    return this.storage
      .filter((entry) => entry.key === key)
      .map(({ target, propertyKey, value }) => ({ target, propertyKey, value: value as T }));
  }

  getAllForTarget<T>(key: MetadataKey, target: MetadataTarget): Array<{ propertyKey?: string | symbol; value: T }> {
    return this.storage
      .filter((entry) => entry.key === key && entry.target === target)
      .map(({ propertyKey, value }) => ({ propertyKey, value: value as T }));
  }

  has(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    return this.storage.some((e) => e.key === key && e.target === target && e.propertyKey === propertyKey);
  }

  delete(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    const index = this.storage.findIndex((e) => e.key === key && e.target === target && e.propertyKey === propertyKey);
    if (index !== -1) {
      this.storage.splice(index, 1);
      return true;
    }
    return false;
  }

  clear(): void {
    this.storage.length = 0;
  }
}

export const MetadataStorage = MetadataStorageImpl.getInstance();
