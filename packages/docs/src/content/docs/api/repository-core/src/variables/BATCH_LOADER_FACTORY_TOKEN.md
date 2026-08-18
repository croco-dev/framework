---
editUrl: false
next: false
prev: false
title: "BATCH_LOADER_FACTORY_TOKEN"
---

> `const` **BATCH_LOADER_FACTORY_TOKEN**: [`Token`](/api/framework-context/src/classes/token/)\<[`IBatchLoaderFactory`](/api/repository-core/src/interfaces/ibatchloaderfactory/)\>

Dependency injection token for IBatchLoaderFactory.

Register your implementation in the DI container:

```typescript
Container.set(BATCH_LOADER_FACTORY_TOKEN, new MyBatchLoaderFactory());
```
