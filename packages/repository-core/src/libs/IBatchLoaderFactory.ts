import { Token } from '@croco/framework-context';

export interface BatchLoaderLike<K, V> {
  load(key: K): Promise<V | null>;
}

export type BatchLoaderFactoryOptions<K, V> = {
  name: string;
  batchFn: (keys: ReadonlyArray<K>) => Promise<ReadonlyArray<V | Error | null>>;
};

export interface IBatchLoaderFactory {
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V>;
}

export const BATCH_LOADER_FACTORY_TOKEN = new Token<IBatchLoaderFactory>('IBatchLoaderFactory');
