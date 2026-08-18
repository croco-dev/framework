---
editUrl: false
next: false
prev: false
title: "WebhookDeliveryOperationsRow"
---

> **WebhookDeliveryOperationsRow** = `object`

## Properties

### attemptCount

> `readonly` **attemptCount**: `number`

---

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### endpointId

> `readonly` **endpointId**: `string`

---

### eventId

> `readonly` **eventId**: `string`

---

### id

> `readonly` **id**: `string`

---

### nextAttemptAt?

> `readonly` `optional` **nextAttemptAt?**: `Date`

---

### problem?

> `readonly` `optional` **problem?**: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/)

---

### replay?

> `readonly` `optional` **replay?**: `object`

#### allowed

> `readonly` **allowed**: `boolean`

#### reason

> `readonly` **reason**: `string`

---

### status

> `readonly` **status**: [`WebhookDeliveryOperationsStatus`](/api/admin-core/src/type-aliases/webhookdeliveryoperationsstatus/)

---

### tenantId

> `readonly` **tenantId**: `string`

---

### updatedAt

> `readonly` **updatedAt**: `Date`
