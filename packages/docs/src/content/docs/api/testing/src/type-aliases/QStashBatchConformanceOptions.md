---
editUrl: false
next: false
prev: false
title: "QStashBatchConformanceOptions"
---

> **QStashBatchConformanceOptions** = `object`

## Properties

### createExecutor()

> `readonly` **createExecutor**: (`scenario`) => [`QStashBatchConformanceHarness`](/api/testing/src/type-aliases/qstashbatchconformanceharness/) \| `Promise`\<[`QStashBatchConformanceHarness`](/api/testing/src/type-aliases/qstashbatchconformanceharness/)\>

#### Parameters

##### scenario

[`QStashBatchConformanceScenario`](/api/testing/src/type-aliases/qstashbatchconformancescenario/)

#### Returns

[`QStashBatchConformanceHarness`](/api/testing/src/type-aliases/qstashbatchconformanceharness/) \| `Promise`\<[`QStashBatchConformanceHarness`](/api/testing/src/type-aliases/qstashbatchconformanceharness/)\>

***

### liveSmoke?

> `readonly` `optional` **liveSmoke**: [`ServerlessProviderLiveSmokeGate`](/api/testing/src/type-aliases/serverlessproviderlivesmokegate/)

***

### providerName

> `readonly` **providerName**: `string`

***

### secretSamples?

> `readonly` `optional` **secretSamples**: readonly `string`[]
