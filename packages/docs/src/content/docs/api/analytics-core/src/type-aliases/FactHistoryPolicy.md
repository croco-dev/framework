---
editUrl: false
next: false
prev: false
title: "FactHistoryPolicy"
---

> **FactHistoryPolicy** = `object`

## Properties

### authorize

> `readonly` **authorize**: (`request`) => `void` \| `Promise`\<`void`\>

#### Parameters

##### request

[`FactAuthorizationRequest`](/api/analytics-core/src/type-aliases/factauthorizationrequest/)

#### Returns

`void` \| `Promise`\<`void`\>

---

### mask

> `readonly` **mask**: (`row`) => [`FactRow`](/api/analytics-core/src/type-aliases/factrow/)

#### Parameters

##### row

[`FactRow`](/api/analytics-core/src/type-aliases/factrow/)

#### Returns

[`FactRow`](/api/analytics-core/src/type-aliases/factrow/)
