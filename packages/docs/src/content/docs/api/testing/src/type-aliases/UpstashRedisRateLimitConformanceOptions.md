---
editUrl: false
next: false
prev: false
title: "UpstashRedisRateLimitConformanceOptions"
---

> **UpstashRedisRateLimitConformanceOptions** = `object`

## Properties

### createMissingConfig?

> `readonly` `optional` **createMissingConfig?**: () => `unknown` \| `Promise`\<`unknown`\>

#### Returns

`unknown` \| `Promise`\<`unknown`\>

---

### createStore

> `readonly` **createStore**: (`scenario`) => [`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/) \| `Promise`\<[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)\>

#### Parameters

##### scenario

[`UpstashRedisRateLimitConformanceScenario`](/api/testing/src/type-aliases/upstashredisratelimitconformancescenario/)

#### Returns

[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/) \| `Promise`\<[`RateLimitStore`](/api/ratelimit-core/src/classes/ratelimitstore/)\>

---

### invalidPolicy

> `readonly` **invalidPolicy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

---

### keyPrefix?

> `readonly` `optional` **keyPrefix?**: `string`

---

### liveSmoke?

> `readonly` `optional` **liveSmoke?**: [`ServerlessProviderLiveSmokeGate`](/api/testing/src/type-aliases/serverlessproviderlivesmokegate/)

---

### policy

> `readonly` **policy**: [`RateLimitPolicy`](/api/ratelimit-core/src/type-aliases/ratelimitpolicy/)

---

### providerName

> `readonly` **providerName**: `string`

---

### secretSamples?

> `readonly` `optional` **secretSamples?**: readonly `string`[]
