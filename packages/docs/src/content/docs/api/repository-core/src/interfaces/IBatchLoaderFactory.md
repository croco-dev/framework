---
editUrl: false
next: false
prev: false
title: "IBatchLoaderFactory"
---

Factory interface for creating context-scoped batch loaders.

Implementations should cache loaders within the current request context
to ensure proper batching across multiple calls to the same loader.
Same-name `create()` calls share one request loader, but installation
timing and `batchFn` selection depend on the implementation.
`BatchLoaderFactory` installs the loader when a wrapper first uses it, so
callers using it must pass the same `batchFn` for a shared name or choose
a unique name per batch function.

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

Within one request, same-name calls share one request loader, but
installation timing and `batchFn` selection depend on the implementation.
`BatchLoaderFactory` installs the loader when a wrapper first uses it and
ignores a different `batchFn` from later same-name calls. Callers using
`BatchLoaderFactory` must use the same `batchFn` for a shared name or a
unique name per batch function.

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
