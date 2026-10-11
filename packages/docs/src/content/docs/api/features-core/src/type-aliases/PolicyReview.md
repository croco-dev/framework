---
editUrl: false
next: false
prev: false
title: "PolicyReview"
---

> **PolicyReview**\<`TValue`\> = `object`

## Type Parameters

### TValue

`TValue` = `unknown`

## Properties

### actor

> `readonly` **actor**: [`PolicyActor`](/api/features-core/src/type-aliases/policyactor/)

---

### reason

> `readonly` **reason**: `string`

---

### reviewedAt

> `readonly` **reviewedAt**: `string`

---

### reviewedHash

> `readonly` **reviewedHash**: `string`

---

### reviewedRevision

> `readonly` **reviewedRevision**: `number`

---

### reviewedValue

> `readonly` **reviewedValue**: `TValue`

---

### semanticDiff

> `readonly` **semanticDiff**: readonly [`PolicySemanticDiff`](/api/features-core/src/type-aliases/policysemanticdiff/)[]

---

### validation

> `readonly` **validation**: [`PolicyValidationResult`](/api/features-core/src/type-aliases/policyvalidationresult/)
