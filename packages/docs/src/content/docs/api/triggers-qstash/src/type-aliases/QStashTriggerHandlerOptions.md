---
editUrl: false
next: false
prev: false
title: "QStashTriggerHandlerOptions"
---

> **QStashTriggerHandlerOptions** = `object`

Configuration options for QStashTriggerHandler.

## Properties

### deliveryIdentityVerifier

> `readonly` **deliveryIdentityVerifier**: [`QStashDeliveryIdentityVerifier`](/api/triggers-qstash/src/type-aliases/qstashdeliveryidentityverifier/)

Authenticates the delivery identity against provider-owned state.

---

### executionManager

> `readonly` **executionManager**: [`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

Execution manager for dispatching executions.

---

### executionTimeout

> `readonly` **executionTimeout**: `number`

Deadline used to reconcile abandoned running executions.

---

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

Maximum attempts for one durable trigger execution.

---

### onDeliveryIdentityVerificationFailure?

> `readonly` `optional` **onDeliveryIdentityVerificationFailure?**: (`failure`) => `void` \| `Promise`\<`void`\>

Receives the original provider failure for logging or telemetry.

#### Parameters

##### failure

[`QStashDeliveryIdentityVerificationFailure`](/api/triggers-qstash/src/type-aliases/qstashdeliveryidentityverificationfailure/)

#### Returns

`void` \| `Promise`\<`void`\>

---

### receiver

> `readonly` **receiver**: `Receiver`

QStash receiver instance for verifying webhook signatures.

---

### serviceResolver?

> `readonly` `optional` **serviceResolver?**: `ServiceResolver`

Optional service resolver for getting target instances.
If not provided, uses the framework Container with constructor fallback.

---

### timeoutRetryPolicy?

> `readonly` `optional` **timeoutRetryPolicy?**: `"idempotent"` \| `"indeterminate"`

Whether a timed-out target may overlap safely with a replacement attempt.
