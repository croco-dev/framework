---
editUrl: false
next: false
prev: false
title: "RetentionWorkbenchProps"
---

> **RetentionWorkbenchProps** = `object`

## Properties

### drilldown?

> `optional` **drilldown?**: [`RetentionDrilldownPage`](/api/admin-core/src/type-aliases/retentiondrilldownpage/)

---

### drilldownState?

> `optional` **drilldownState?**: `"loading"` \| `"denied"` \| `"error"` \| `"stale"`

---

### onNextPage?

> `optional` **onNextPage?**: (`selectionId`, `offset`, `inputToken`) => `void`

#### Parameters

##### selectionId

`string`

##### offset

`number`

##### inputToken

`string`

#### Returns

`void`

---

### onReload

> **onReload**: () => `void`

#### Returns

`void`

---

### onSelectMetric

> **onSelectMetric**: (`selectionId`, `inputToken`) => `void`

#### Parameters

##### selectionId

`string`

##### inputToken

`string`

#### Returns

`void`

---

### state

> **state**: [`RetentionWorkbenchState`](/api/admin-core/src/type-aliases/retentionworkbenchstate/)
