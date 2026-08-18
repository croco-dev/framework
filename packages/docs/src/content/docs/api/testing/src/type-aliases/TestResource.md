---
editUrl: false
next: false
prev: false
title: "TestResource"
---

> **TestResource**\<`TConnection`\> = `object`

## Type Parameters

### TConnection

`TConnection`

## Properties

### fidelityHint?

> `readonly` `optional` **fidelityHint?**: [`TestResourceFidelity`](/api/testing/src/type-aliases/testresourcefidelity/)

---

### id

> `readonly` **id**: `string`

---

### start

> `readonly` **start**: (`context`) => `Promise`\<[`StartedTestResource`](/api/testing/src/type-aliases/startedtestresource/)\<`TConnection`\>\>

#### Parameters

##### context

[`TestResourceStartContext`](/api/testing/src/type-aliases/testresourcestartcontext/)

#### Returns

`Promise`\<[`StartedTestResource`](/api/testing/src/type-aliases/startedtestresource/)\<`TConnection`\>\>
