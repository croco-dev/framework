---
editUrl: false
next: false
prev: false
title: "LifecycleRun"
---

> **LifecycleRun** = `object`

## Properties

### actionResults

> `readonly` **actionResults**: readonly [`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)[]

---

### completedAt

> `readonly` **completedAt**: `Date`

---

### error?

> `readonly` `optional` **error?**: `object`

#### code?

> `readonly` `optional` **code?**: `string`

#### message

> `readonly` **message**: `string`

---

### id

> `readonly` **id**: `string`

---

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

---

### ruleFingerprint

> `readonly` **ruleFingerprint**: `string`

---

### ruleId

> `readonly` **ruleId**: `string`

---

### ruleVersion

> `readonly` **ruleVersion**: `string`

---

### severity

> `readonly` **severity**: [`LifecycleSeverity`](/api/lifecycle-core/src/type-aliases/lifecycleseverity/)

---

### signalId?

> `readonly` `optional` **signalId?**: `string`

---

### signalSource?

> `readonly` `optional` **signalSource?**: `string`

Source namespace captured from the signal at claim time. Together with
`signalId` this preserves the redeliverable source event identity.

---

### signalType

> `readonly` **signalType**: [`LifecycleSignalType`](/api/lifecycle-core/src/type-aliases/lifecyclesignaltype/)

---

### skipReason?

> `readonly` `optional` **skipReason?**: [`LifecycleSkipReason`](/api/lifecycle-core/src/type-aliases/lifecycleskipreason/)

---

### sourceFingerprint?

> `readonly` `optional` **sourceFingerprint?**: `string`

Canonical semantic payload fingerprint used only for conflict checks on
redelivery with the same source identity. Never an identity input.

---

### startedAt

> `readonly` **startedAt**: `Date`

---

### status

> `readonly` **status**: [`LifecycleRunStatus`](/api/lifecycle-core/src/type-aliases/lifecyclerunstatus/)

---

### tenantId

> `readonly` **tenantId**: `string`
