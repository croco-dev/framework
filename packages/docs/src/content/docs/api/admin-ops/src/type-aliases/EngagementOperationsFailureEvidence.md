---
editUrl: false
next: false
prev: false
title: "EngagementOperationsFailureEvidence"
---

> **EngagementOperationsFailureEvidence** = `object`

## Properties

### attemptCount?

> `readonly` `optional` **attemptCount?**: `number`

---

### campaignId?

> `readonly` `optional` **campaignId?**: `string`

---

### channel

> `readonly` **channel**: `"email"` \| `"push"`

---

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

---

### createdAt

> `readonly` **createdAt**: `Date`

---

### dispatchId

> `readonly` **dispatchId**: `string`

---

### failureReason?

> `readonly` `optional` **failureReason?**: `string`

---

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

---

### messageId

> `readonly` **messageId**: `string`

---

### nextAttemptAt?

> `readonly` `optional` **nextAttemptAt?**: `Date`

---

### problem?

> `readonly` `optional` **problem?**: `object`

#### code

> `readonly` **code**: `string`

#### message

> `readonly` **message**: `string`

#### retryable?

> `readonly` `optional` **retryable?**: `boolean`

---

### providerAccepted

> `readonly` **providerAccepted**: `boolean`

---

### recipientId

> `readonly` **recipientId**: `string`

---

### retryable

> `readonly` **retryable**: `boolean`

---

### status

> `readonly` **status**: `"queued"` \| `"accepted"` \| `"suppressed"` \| `"failed"` \| `"skipped"` \| `"delivered"`

---

### suppressionReason?

> `readonly` `optional` **suppressionReason?**: `string`

---

### tenantId

> `readonly` **tenantId**: `string`

---

### updatedAt

> `readonly` **updatedAt**: `Date`
