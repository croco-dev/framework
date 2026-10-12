---
editUrl: false
next: false
prev: false
title: "BehaviorMetricResult"
---

> **BehaviorMetricResult** = `object`

## Properties

### availability

> **availability**: [`BehaviorAvailability`](/api/metrics-core/src/type-aliases/behavioravailability/)

---

### definitionId

> **definitionId**: `string`

---

### definitionVersion

> **definitionVersion**: `string`

---

### denominator

> **denominator**: `number`

---

### numerator

> **numerator**: `number`

---

### reason

> **reason**: [`BehaviorReason`](/api/metrics-core/src/type-aliases/behaviorreason/)

---

### sourceRefs

> **sourceRefs**: [`BehaviorSourceRef`](/api/metrics-core/src/type-aliases/behaviorsourceref/)[]

---

### subjects

> **subjects**: [`BehaviorSubjectMembership`](/api/metrics-core/src/type-aliases/behaviorsubjectmembership/)[]

---

### value

> **value**: `number` \| `null`

Ratio in [0, 1]; null when observation cannot establish a value.

---

### window

> **window**: [`BehaviorResolvedWindow`](/api/metrics-core/src/type-aliases/behaviorresolvedwindow/)
