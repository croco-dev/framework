---
editUrl: false
next: false
prev: false
title: "PolicyRevision"
---

> **PolicyRevision**\<`TValue`\> = `object`

## Type Parameters

### TValue

`TValue` = `unknown`

## Properties

### codeRegistrationId

> `readonly` **codeRegistrationId**: `string`

---

### fallback?

> `readonly` `optional` **fallback?**: `TValue`

---

### hash

> `readonly` **hash**: `string`

---

### history

> `readonly` **history**: readonly [`PolicyTransitionRecord`](/api/features-core/src/type-aliases/policytransitionrecord/)[]

---

### id

> `readonly` **id**: `string`

---

### pauseReason?

> `readonly` `optional` **pauseReason?**: `string`

---

### policyId

> `readonly` **policyId**: `string`

---

### publication?

> `readonly` `optional` **publication?**: [`PolicyPublication`](/api/features-core/src/type-aliases/policypublication/)

---

### registrationFingerprint

> `readonly` **registrationFingerprint**: `string`

---

### review?

> `readonly` `optional` **review?**: [`PolicyReview`](/api/features-core/src/type-aliases/policyreview/)\<`TValue`\>

---

### revision

> `readonly` **revision**: `number`

---

### rollbackOf?

> `readonly` `optional` **rollbackOf?**: `number`

---

### scheduledFor?

> `readonly` `optional` **scheduledFor?**: `string`

---

### scheduleIdempotencyKey?

> `readonly` `optional` **scheduleIdempotencyKey?**: `string`

---

### schemaVersion

> `readonly` **schemaVersion**: `string`

---

### scope

> `readonly` **scope**: [`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

---

### state

> `readonly` **state**: [`PolicyRevisionState`](/api/features-core/src/type-aliases/policyrevisionstate/)

---

### value

> `readonly` **value**: `TValue`

---

### version

> `readonly` **version**: `number`

Published revisions use their immutable revision as their policy version.
