---
editUrl: false
next: false
prev: false
title: "ExperimentAuthorizationRequest"
---

> **ExperimentAuthorizationRequest** = `object`

## Properties

### action

> `readonly` **action**: `"configure"` \| `"register"` \| `"read"` \| `"preview"` \| `"assign"` \| `"treat"` \| `"exposure"` \| `"start"` \| `"pause"` \| `"stop"`

---

### actor

> `readonly` **actor**: `string`

---

### experimentId

> `readonly` **experimentId**: `string`

---

### scope

> `readonly` **scope**: [`ExperimentScope`](/api/features-core/src/type-aliases/experimentscope/)

---

### subject?

> `readonly` `optional` **subject?**: [`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/)
