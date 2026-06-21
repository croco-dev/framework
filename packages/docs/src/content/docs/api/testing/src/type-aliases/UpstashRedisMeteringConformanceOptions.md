---
editUrl: false
next: false
prev: false
title: "UpstashRedisMeteringConformanceOptions"
---

> **UpstashRedisMeteringConformanceOptions** = `object`

## Properties

### createClient()

> `readonly` **createClient**: (`scenario`) => [`UpstashRedisMeteringClient`](/api/testing/src/type-aliases/upstashredismeteringclient/) \| `Promise`\<[`UpstashRedisMeteringClient`](/api/testing/src/type-aliases/upstashredismeteringclient/)\>

#### Parameters

##### scenario

[`UpstashRedisMeteringConformanceScenario`](/api/testing/src/type-aliases/upstashredismeteringconformancescenario/)

#### Returns

[`UpstashRedisMeteringClient`](/api/testing/src/type-aliases/upstashredismeteringclient/) \| `Promise`\<[`UpstashRedisMeteringClient`](/api/testing/src/type-aliases/upstashredismeteringclient/)\>

***

### createMissingConfig()?

> `readonly` `optional` **createMissingConfig**: () => `unknown` \| `Promise`\<`unknown`\>

#### Returns

`unknown` \| `Promise`\<`unknown`\>

***

### keyPrefix?

> `readonly` `optional` **keyPrefix**: `string`

***

### liveSmoke?

> `readonly` `optional` **liveSmoke**: [`ServerlessProviderLiveSmokeGate`](/api/testing/src/type-aliases/serverlessproviderlivesmokegate/)

***

### providerName

> `readonly` **providerName**: `string`

***

### secretSamples?

> `readonly` `optional` **secretSamples**: readonly `string`[]
