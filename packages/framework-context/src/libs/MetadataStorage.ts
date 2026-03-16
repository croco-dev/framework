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
  private readonly storage = new Map<string, MetadataEntry>();
  private keyIds = new Map<MetadataKey, number>();
  private keyIdCounter = 0;
  private targetIds = new WeakMap<object, number>();
  private targetIdCounter = 0;

  private getKeyId(key: MetadataKey): number {
    let id = this.keyIds.get(key);
    if (id === undefined) {
      id = ++this.keyIdCounter;
      this.keyIds.set(key, id);
    }

    return id;
  }

  private getTargetId(target: object): number {
    let id = this.targetIds.get(target);
    if (id === undefined) {
      id = ++this.targetIdCounter;
      this.targetIds.set(target, id);
    }
    return id;
  }

  static getInstance(): MetadataStorageImpl {
    if (!MetadataStorageImpl.INSTANCE) {
      MetadataStorageImpl.INSTANCE = new MetadataStorageImpl();
    }
    return MetadataStorageImpl.INSTANCE;
  }

  private makeKey(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): string {
    const keyId = String(this.getKeyId(key));
    const targetId = String(this.getTargetId(target as object));
    const propStr = propertyKey ? String(propertyKey) : '';
    return `${keyId}::${targetId}::${propStr}`;
  }

  define<T>(key: MetadataKey, target: MetadataTarget, value: T, propertyKey?: string | symbol): void {
    const compositeKey = this.makeKey(key, target, propertyKey);
    if (process.env.NODE_ENV !== 'production' && this.storage.has(compositeKey)) {
      console.warn(`[MetadataStorage] Overwriting existing metadata for key: ${String(key)}`);
    }
    this.storage.set(compositeKey, { key, target, propertyKey, value });
  }

  get<T>(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): T | undefined {
    const compositeKey = this.makeKey(key, target, propertyKey);
    return this.storage.get(compositeKey)?.value as T | undefined;
  }

  getAll<T>(key: MetadataKey): Array<{ target: MetadataTarget; propertyKey?: string | symbol; value: T }> {
    const entries: MetadataEntry[] = [];
    for (const entry of this.storage.values()) {
      if (entry.key === key) entries.push(entry);
    }
    return entries.map(({ target, propertyKey, value }) => ({ target, propertyKey, value: value as T }));
  }

  getAllForTarget<T>(key: MetadataKey, target: MetadataTarget): Array<{ propertyKey?: string | symbol; value: T }> {
    const entries: MetadataEntry[] = [];
    for (const entry of this.storage.values()) {
      if (entry.key === key && entry.target === target) entries.push(entry);
    }
    return entries.map(({ propertyKey, value }) => ({ propertyKey, value: value as T }));
  }

  has(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    const compositeKey = this.makeKey(key, target, propertyKey);
    return this.storage.has(compositeKey);
  }

  delete(key: MetadataKey, target: MetadataTarget, propertyKey?: string | symbol): boolean {
    const compositeKey = this.makeKey(key, target, propertyKey);
    return this.storage.delete(compositeKey);
  }

  clear(): void {
    this.storage.clear();
    this.keyIds = new Map<MetadataKey, number>();
    this.keyIdCounter = 0;
    this.targetIds = new WeakMap<object, number>();
    this.targetIdCounter = 0;
  }
}

export const MetadataStorage = MetadataStorageImpl.getInstance();
