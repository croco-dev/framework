---
editUrl: false
next: false
prev: false
title: "LifecycleRuleRegistrationInput"
---

> **LifecycleRuleRegistrationInput** = `object`

## Properties

### actionDescriptors?

> `readonly` `optional` **actionDescriptors?**: readonly [`LifecycleRuleActionDescriptor`](/api/lifecycle-core/src/type-aliases/lifecycleruleactiondescriptor/)[]

---

### activate?

> `readonly` `optional` **activate?**: `boolean`

---

### contextRequirements?

> `readonly` `optional` **contextRequirements?**: readonly `string`[]

---

### executableFingerprint

> `readonly` **executableFingerprint**: `string`

Stable fingerprint of the generated/bundled executable artifact and its captured configuration.
This value must change whenever executable rule behavior changes.

---

### executableRegistrationId

> `readonly` **executableRegistrationId**: `string`

---

### registeredAt?

> `readonly` `optional` **registeredAt?**: `Date`

---

### rule

> `readonly` **rule**: [`LifecycleRule`](/api/lifecycle-core/src/type-aliases/lifecyclerule/)

---

### version

> `readonly` **version**: `string`
