import {
  type BatchLoaderFactoryOptions,
  type BatchLoaderLike,
  type IBatchLoaderFactory,
} from "@croco/repository-core";
import { createOwnedBatchLoader } from "./createBatchLoader";

// IBatchLoaderFactory.create() retrieves request loaders by name and @BatchLoad calls it per invocation.
const BATCH_LOADER_FACTORY_OWNER = Symbol("BatchLoaderFactory");

export class BatchLoaderFactory implements IBatchLoaderFactory {
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    return createOwnedBatchLoader(options, BATCH_LOADER_FACTORY_OWNER);
  }
}
