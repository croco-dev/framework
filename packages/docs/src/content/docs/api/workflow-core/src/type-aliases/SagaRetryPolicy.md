---
editUrl: false
next: false
prev: false
title: "SagaRetryPolicy"
---

> **SagaRetryPolicy** = `object`

## Properties

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

***

### shouldRetry?

> `readonly` `optional` **shouldRetry?**: (`context`) => `boolean` \| `Promise`\<`boolean`\>

#### Parameters

##### context

[`SagaRetryContext`](/api/workflow-core/src/type-aliases/sagaretrycontext/)

#### Returns

`boolean` \| `Promise`\<`boolean`\>
