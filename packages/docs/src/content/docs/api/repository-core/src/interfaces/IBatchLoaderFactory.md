---
editUrl: false
next: false
prev: false
title: "IBatchLoaderFactory"
---

Factory interface for creating context-scoped batch loaders.

Implementations should cache loaders within the current request context
to ensure proper batching across multiple calls to the same loader.
Same-name `create()` calls share one request loader (the wrapper that
first uses it installs the loader), so direct callers must pass the same
`batchFn` for a shared name or choose a unique name per batch function.

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

Retrieval is by name: same-name calls share one request loader, installed
by whichever wrapper first uses it; a different `batchFn` in another
same-name call is then ignored. Direct callers must therefore keep the
`batchFn` identical for a shared name or use a unique name per batch
function.

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
