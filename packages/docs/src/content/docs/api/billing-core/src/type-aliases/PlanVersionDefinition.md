---
editUrl: false
next: false
prev: false
title: "PlanVersionDefinition"
---

> **PlanVersionDefinition** = `object`

JSON-serializable, immutable definition of one published plan version.
ISO timestamps are used instead of Date values so definitions can be persisted and generated.

## Properties

### effectiveAt

> `readonly` **effectiveAt**: `string`

---

### plan

> `readonly` **plan**: `Readonly`\<[`Plan`](/api/billing-core/src/type-aliases/plan/)\>

---

### planId

> `readonly` **planId**: `string`

---

### providerBindings

> `readonly` **providerBindings**: readonly [`ProviderPriceBinding`](/api/billing-core/src/type-aliases/providerpricebinding/)[]

---

### publishedAt

> `readonly` **publishedAt**: `string`

---

### rating

> `readonly` **rating**: [`PlanRatingDefinition`](/api/billing-core/src/type-aliases/planratingdefinition/)

---

### ref

> `readonly` **ref**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### version

> `readonly` **version**: `string`
