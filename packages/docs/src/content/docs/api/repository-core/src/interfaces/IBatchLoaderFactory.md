---
editUrl: false
next: false
prev: false
title: "IBatchLoaderFactory"
---

Factory interface for creating context-scoped batch loaders.

Implementations should cache loaders within the current request context
to ensure proper batching across multiple calls to the same loader.

## Example

```typescript
class MyBatchLoaderFactory implements IBatchLoaderFactory {
  create<K, V>(options: BatchLoaderFactoryOptions<K, V>): BatchLoaderLike<K, V> {
    const cache = Context.getCache();
    const cacheKey = `loader:${options.name}`;

    let loader = cache?.get(cacheKey);
    if (!loader) {
      loader = new DataLoader(options.batchFn);
      cache?.set(cacheKey, loader);
    }

    return loader;
  }
}
```

## Methods

### create()

> **create**\<`K`, `V`\>(`options`): [`BatchLoaderLike`](/api/repository-core/src/interfaces/batchloaderlike/)\<`K`, `V`\>

Create or retrieve a context-scoped batch loader.

#### Type Parameters

##### K

`K`

##### V

`V`

#### Parameters

##### options

[`BatchLoaderFactoryOptions`](/api/repository-core/src/type-aliases/batchloaderfactoryoptions/)\<`K`, `V`\>

The loader options

#### Returns

[`BatchLoaderLike`](/api/repository-core/src/interfaces/batchloaderlike/)\<`K`, `V`\>

A batch loader instance
