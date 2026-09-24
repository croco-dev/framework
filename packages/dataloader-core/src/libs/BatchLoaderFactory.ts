import {
  type BatchLoaderFactoryOptions,
  type BatchLoaderLike,
  type IBatchLoaderFactory,
} from "@croco/repository-core";
import { createBatchLoader } from "./createBatchLoader";

export class BatchLoaderFactory implements IBatchLoaderFactory {
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    return createBatchLoader(options);
  }
}
