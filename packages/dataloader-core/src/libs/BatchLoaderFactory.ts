import { Container } from '@croco/framework-context';
import {
  BATCH_LOADER_FACTORY_TOKEN,
  type BatchLoaderFactoryOptions,
  type BatchLoaderLike,
  type IBatchLoaderFactory,
} from '@croco/repository-core';
import { createBatchLoader } from './createBatchLoader';

export class BatchLoaderFactory implements IBatchLoaderFactory {
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    return createBatchLoader(options);
  }
}

const defaultBatchLoaderFactory = new BatchLoaderFactory();

export function registerBatchLoaderFactory(factory: IBatchLoaderFactory = defaultBatchLoaderFactory): void {
  Container.set(BATCH_LOADER_FACTORY_TOKEN, factory);
}
