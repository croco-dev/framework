---
editUrl: false
next: false
prev: false
title: "ResearchRecord"
---

> **ResearchRecord** = `object`

Bounded aggregate: at most 10,000 candidates and 50,000 audited mutations per study.

## Properties

### candidateFingerprints

> **candidateFingerprints**: `object`[]

#### fingerprint

> **fingerprint**: `string`

#### subject

> **subject**: `string`

---

### candidates

> **candidates**: [`Candidate`](/api/research-core/src/type-aliases/candidate/)[]

---

### consents

> **consents**: `object`[]

#### contact

> **contact**: `boolean`

#### participation

> **participation**: `boolean`

#### recordedAt

> **recordedAt**: `string`

#### source

> **source**: `string`

#### subject

> **subject**: `string`

---

### definition?

> `optional` **definition?**: [`StudyDefinition`](/api/research-core/src/type-aliases/studydefinition/)

---

### history

> **history**: [`ResearchAudit`](/api/research-core/src/type-aliases/researchaudit/)[]

---

### invitations

> **invitations**: [`Invitation`](/api/research-core/src/type-aliases/invitation/)[]

---

### mutations

> **mutations**: `object`[]

#### fingerprint

> **fingerprint**: `string`

#### key

> **key**: `string`

---

### notes

> **notes**: [`ResearchNote`](/api/research-core/src/type-aliases/researchnote/)[]

---

### revision

> **revision**: `number`
