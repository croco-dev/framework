---
editUrl: false
next: false
prev: false
title: "FactHistoryPanelProps"
---

> **FactHistoryPanelProps** = `object`

## Properties

### actor

> `readonly` **actor**: `string`

---

### canCorrect

> `readonly` **canCorrect**: `boolean`

---

### onCompare

> `readonly` **onCompare**: (`request`) => `Promise`\<`void`\>

#### Parameters

##### request

[`FactHistoryComparisonRequest`](/api/admin-core/src/type-aliases/facthistorycomparisonrequest/)

#### Returns

`Promise`\<`void`\>

---

### onCorrect

> `readonly` **onCorrect**: (`request`) => `Promise`\<`void`\>

#### Parameters

##### request

[`FactHistoryCorrectionRequest`](/api/admin-core/src/type-aliases/facthistorycorrectionrequest/)

#### Returns

`Promise`\<`void`\>

---

### request

> `readonly` **request**: [`FactHistoryComparisonRequest`](/api/admin-core/src/type-aliases/facthistorycomparisonrequest/)

---

### state

> `readonly` **state**: [`FactHistoryState`](/api/admin-core/src/type-aliases/facthistorystate/)
