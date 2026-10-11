---
editUrl: false
next: false
prev: false
title: "ActivationDefinition"
---

> **ActivationDefinition** = `object`

## Properties

### candidates

> `readonly` **candidates**: readonly [`ActivationCandidate`](/api/metrics-core/src/type-aliases/activationcandidate/)[]

---

### cohortPolicy

> `readonly` **cohortPolicy**: `"new"` \| `"returning"` \| `"separate"`

---

### id

> `readonly` **id**: `string`

---

### maxCandidates

> `readonly` **maxCandidates**: `number`

---

### maxRows

> `readonly` **maxRows**: `number`

---

### minSupport

> `readonly` **minSupport**: `number`

---

### outcomeWindow

> `readonly` **outcomeWindow**: [`ActivationOutcomeWindow`](/api/metrics-core/src/type-aliases/activationoutcomewindow/)

---

### sourceRevisions

> `readonly` **sourceRevisions**: `Readonly`\<`Record`\<`string`, `string`\>\>

---

### sourceRunRef

> `readonly` **sourceRunRef**: `string`

---

### subjectKind

> `readonly` **subjectKind**: `"user"` \| `"account"`

---

### timezone

> `readonly` **timezone**: `string`

---

### unit

> `readonly` **unit**: `string`

---

### version

> `readonly` **version**: `number`

---

### windows

> `readonly` **windows**: readonly [`ActivationWindow`](/api/metrics-core/src/type-aliases/activationwindow/)[]
