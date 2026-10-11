---
editUrl: false
next: false
prev: false
title: "RetentionWorkbenchRequest"
---

> **RetentionWorkbenchRequest** = `object`

## Properties

### definitionId

> **definitionId**: `string`

---

### definitionVersion

> **definitionVersion**: `string`

---

### savedViewId?

> `optional` **savedViewId?**: `string`

---

### scope

> **scope**: [`BehaviorScope`](/api/metrics-core/src/type-aliases/behaviorscope/)

---

### selections

> **selections**: readonly [`RetentionMetricSelection`](/api/admin-core/src/type-aliases/retentionmetricselection/)[]

---

### sourceRef?

> `optional` **sourceRef?**: `string`

Immutable host source run; required when saving a view.

---

### subjectKind

> **subjectKind**: `string`
