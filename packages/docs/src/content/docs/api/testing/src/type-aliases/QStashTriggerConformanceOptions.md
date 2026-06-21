---
editUrl: false
next: false
prev: false
title: "QStashTriggerConformanceOptions"
---

> **QStashTriggerConformanceOptions** = `object`

## Properties

### createHarness()

> `readonly` **createHarness**: (`scenario`) => [`QStashTriggerConformanceHarness`](/api/testing/src/type-aliases/qstashtriggerconformanceharness/) \| `Promise`\<[`QStashTriggerConformanceHarness`](/api/testing/src/type-aliases/qstashtriggerconformanceharness/)\>

#### Parameters

##### scenario

[`QStashTriggerConformanceScenario`](/api/testing/src/type-aliases/qstashtriggerconformancescenario/)

#### Returns

[`QStashTriggerConformanceHarness`](/api/testing/src/type-aliases/qstashtriggerconformanceharness/) \| `Promise`\<[`QStashTriggerConformanceHarness`](/api/testing/src/type-aliases/qstashtriggerconformanceharness/)\>

***

### liveSmoke?

> `readonly` `optional` **liveSmoke**: [`ServerlessProviderLiveSmokeGate`](/api/testing/src/type-aliases/serverlessproviderlivesmokegate/)

***

### providerName

> `readonly` **providerName**: `string`

***

### secretSamples?

> `readonly` `optional` **secretSamples**: readonly `string`[]
