---
editUrl: false
next: false
prev: false
title: "FactHistorySnapshot"
---

> **FactHistorySnapshot** = `object`

## Properties

### after

> `readonly` **after**: [`FactHistoryPoint`](/api/admin-core/src/type-aliases/facthistorypoint/)

---

### before

> `readonly` **before**: [`FactHistoryPoint`](/api/admin-core/src/type-aliases/facthistorypoint/)

---

### decisionSnapshot?

> `readonly` `optional` **decisionSnapshot?**: `object`

#### evidence

> `readonly` **evidence**: readonly `string`[]

#### id

> `readonly` **id**: `string`

---

### request

> `readonly` **request**: [`FactHistoryComparisonRequest`](/api/admin-core/src/type-aliases/facthistorycomparisonrequest/)

---

### revision

> `readonly` **revision**: `number`

---

### rows

> `readonly` **rows**: readonly [`FactHistoryDisplayRow`](/api/admin-core/src/type-aliases/facthistorydisplayrow/)[]
