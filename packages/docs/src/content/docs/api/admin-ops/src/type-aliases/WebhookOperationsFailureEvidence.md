---
editUrl: false
next: false
prev: false
title: "WebhookOperationsFailureEvidence"
---

> **WebhookOperationsFailureEvidence** = `object`

## Properties

### attemptCount

> `readonly` **attemptCount**: `number`

***

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

***

### createdAt

> `readonly` **createdAt**: `Date`

***

### deliveryId

> `readonly` **deliveryId**: `string`

***

### endpointId

> `readonly` **endpointId**: `string`

***

### endpointStatus

> `readonly` **endpointStatus**: `"active"` \| `"paused"` \| `"disabled"`

***

### eventId

> `readonly` **eventId**: `string`

***

### eventName

> `readonly` **eventName**: `string`

***

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

***

### nextAttemptAt?

> `readonly` `optional` **nextAttemptAt?**: `Date`

***

### problem?

> `readonly` `optional` **problem?**: `object`

#### code

> `readonly` **code**: `string`

#### message

> `readonly` **message**: `string`

#### retryable?

> `readonly` `optional` **retryable?**: `boolean`

***

### replay?

> `readonly` `optional` **replay?**: `object`

#### allowed

> `readonly` **allowed**: `boolean`

#### reason

> `readonly` **reason**: `string`

***

### schemaVersion

> `readonly` **schemaVersion**: `string`

***

### status

> `readonly` **status**: `"pending"` \| `"accepted"` \| `"delivered"` \| `"retrying"` \| `"dead"` \| `"canceled"` \| `"acceptance-unknown"`

***

### subject

> `readonly` **subject**: `string`

***

### tenantId

> `readonly` **tenantId**: `string`

***

### updatedAt

> `readonly` **updatedAt**: `Date`
