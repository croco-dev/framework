---
editUrl: false
next: false
prev: false
title: "PlanRelease"
---

> **PlanRelease** = `object`

## Properties

### definition

> `readonly` **definition**: [`PlanVersionDefinition`](/api/billing-core/src/type-aliases/planversiondefinition/)

---

### history

> `readonly` **history**: readonly [`PlanReleaseTransitionRecord`](/api/billing-core/src/type-aliases/planreleasetransitionrecord/)[]

---

### publication?

> `readonly` `optional` **publication?**: [`PlanReleasePublicationEvidence`](/api/billing-core/src/type-aliases/planreleasepublicationevidence/)

---

### publicationFailures?

> `readonly` `optional` **publicationFailures?**: readonly [`PlanReleasePublicationFailure`](/api/billing-core/src/type-aliases/planreleasepublicationfailure/)[]

---

### publicationIntent?

> `readonly` `optional` **publicationIntent?**: [`PlanReleasePublicationIntent`](/api/billing-core/src/type-aliases/planreleasepublicationintent/)

---

### ref

> `readonly` **ref**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### review?

> `readonly` `optional` **review?**: [`PlanReleaseReviewEvidence`](/api/billing-core/src/type-aliases/planreleasereviewevidence/)

---

### revision

> `readonly` **revision**: `number`

---

### scheduledFor?

> `readonly` `optional` **scheduledFor?**: `string`

---

### state

> `readonly` **state**: [`PlanReleaseState`](/api/billing-core/src/type-aliases/planreleasestate/)

---

### supersededBy?

> `readonly` `optional` **supersededBy?**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)
