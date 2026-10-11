---
editUrl: false
next: false
prev: false
title: "GoalCorrection"
---

> **GoalCorrection** = `object`

## Properties

### actionId

> **actionId**: `string`

---

### confirmation

> **confirmation**: [`ActionReceipt`](/api/onboarding-core/src/type-aliases/actionreceipt/)\[`"confirmation"`\]

---

### correction

> **correction**: \{ `kind`: `"retract_event"`; `targetEventId`: `string`; \} \| \{ `kind`: `"delete_object"`; `objectId`: `string`; \}

---

### eventId

> **eventId**: `string`

---

### occurredAt

> **occurredAt**: `Date`
