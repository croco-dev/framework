type BatchLoadFn<K, V> = (keys: K[]) => Promise<V[]>;

export class Dataloader<K, V> {
  private readonly cache = new Map<K, V>();
  private readonly queue: Array<{ key: K; resolve: (value: V) => void; reject: (error: Error) => void }> = [];
  private scheduled = false;

  constructor(private readonly batchFn: BatchLoadFn<K, V>) {}

  async load(key: K): Promise<V> {
    const cached = this.cache.get(key);
    if (cached !== undefined) {
      return cached;
    }

    return new Promise<V>((resolve, reject) => {
      this.queue.push({ key, resolve, reject });

      if (!this.scheduled) {
        this.scheduled = true;
        process.nextTick(() => this.executeBatch());
      }
    });
  }

  clear(key: K): void {
    this.cache.delete(key);
  }

  clearAll(): void {
    this.cache.clear();
  }

  prime(key: K, value: V): void {
    if (!this.cache.has(key)) {
      this.cache.set(key, value);
    }
  }

  private async executeBatch(): Promise<void> {
    const batch = this.queue.splice(0, this.queue.length);
    this.scheduled = false;

    if (batch.length === 0) {
      return;
    }

    const keys = batch.map((item) => item.key);
    const uniqueKeys = [...new Set(keys)];

    try {
      const values = await this.batchFn(uniqueKeys);

      if (values.length !== uniqueKeys.length) {
        throw new Error(
          `Dataloader batch function must return array of same length as keys. Expected ${uniqueKeys.length}, got ${values.length}`
        );
      }

      const valueMap = new Map(uniqueKeys.map((key, index) => [key, values[index]]));

      for (const item of batch) {
        const value = valueMap.get(item.key);
        if (value === undefined) {
          item.reject(new Error(`No value returned for key: ${String(item.key)}`));
        } else {
          this.cache.set(item.key, value);
          item.resolve(value);
        }
      }
    } catch (error) {
      for (const item of batch) {
        item.reject(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }
}
