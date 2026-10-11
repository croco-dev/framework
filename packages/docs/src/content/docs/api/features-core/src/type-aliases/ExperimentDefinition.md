---
editUrl: false
next: false
prev: false
title: "ExperimentDefinition"
---

> **ExperimentDefinition** = `object`

## Properties

### allocation

> `readonly` **allocation**: `number`

Basis points, inclusive zero and exclusive allocation; weights must sum to allocation.

---

### allocatorVersion

> `readonly` **allocatorVersion**: `"sha256-v1"`

---

### eligibility

> `readonly` **eligibility**: `string`

---

### endsAt?

> `readonly` `optional` **endsAt?**: `string`

---

### hypothesis

> `readonly` **hypothesis**: `string`

---

### id

> `readonly` **id**: `string`

---

### loginPolicy

> `readonly` **loginPolicy**: `"preserve-unit"` \| `"switch-unit"`

Preserve anonymous identity through login, or explicitly switch identity without merging history.

---

### observationPlan

> `readonly` **observationPlan**: `string`

---

### revision

> `readonly` **revision**: `string`

---

### salt

> `readonly` **salt**: `string`

---

### startsAt?

> `readonly` `optional` **startsAt?**: `string`

---

### unit

> `readonly` **unit**: [`ExperimentUnit`](/api/features-core/src/type-aliases/experimentunit/)

---

### variants

> `readonly` **variants**: readonly [`ExperimentVariant`](/api/features-core/src/type-aliases/experimentvariant/)[]
