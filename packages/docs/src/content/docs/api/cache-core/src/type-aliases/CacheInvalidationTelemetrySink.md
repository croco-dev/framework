---
editUrl: false
next: false
prev: false
title: "CacheInvalidationTelemetrySink"
---

> **CacheInvalidationTelemetrySink** = `object`

## Properties

### recordError?

> `readonly` `optional` **recordError?**: (`problem`, `context`) => `void`

#### Parameters

##### problem

[`CacheInvalidationFailedProblem`](/api/cache-core/src/classes/cacheinvalidationfailedproblem/)

##### context

[`CacheInvalidationTelemetryContext`](/api/cache-core/src/type-aliases/cacheinvalidationtelemetrycontext/)

#### Returns

`void`

---

### recordEvent?

> `readonly` `optional` **recordEvent?**: (`event`) => `void`

#### Parameters

##### event

[`CacheInvalidationTelemetryEvent`](/api/cache-core/src/type-aliases/cacheinvalidationtelemetryevent/)

#### Returns

`void`
