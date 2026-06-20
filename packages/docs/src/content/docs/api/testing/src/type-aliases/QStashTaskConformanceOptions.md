---
editUrl: false
next: false
prev: false
title: "QStashTaskConformanceOptions"
---

> **QStashTaskConformanceOptions** = `object`

## Properties

### createMissingConfig()?

> `readonly` `optional` **createMissingConfig**: () => `unknown` \| `Promise`\<`unknown`\>

#### Returns

`unknown` \| `Promise`\<`unknown`\>

***

### createPublisher()

> `readonly` **createPublisher**: (`scenario`) => [`QStashTaskConformanceHarness`](/api/testing/src/type-aliases/qstashtaskconformanceharness/) \| `Promise`\<[`QStashTaskConformanceHarness`](/api/testing/src/type-aliases/qstashtaskconformanceharness/)\>

#### Parameters

##### scenario

[`QStashTaskConformanceScenario`](/api/testing/src/type-aliases/qstashtaskconformancescenario/)

#### Returns

[`QStashTaskConformanceHarness`](/api/testing/src/type-aliases/qstashtaskconformanceharness/) \| `Promise`\<[`QStashTaskConformanceHarness`](/api/testing/src/type-aliases/qstashtaskconformanceharness/)\>

***

### liveSmoke?

> `readonly` `optional` **liveSmoke**: [`ServerlessProviderLiveSmokeGate`](/api/testing/src/type-aliases/serverlessproviderlivesmokegate/)

***

### providerName

> `readonly` **providerName**: `string`

***

### secretSamples?

> `readonly` `optional` **secretSamples**: readonly `string`[]
