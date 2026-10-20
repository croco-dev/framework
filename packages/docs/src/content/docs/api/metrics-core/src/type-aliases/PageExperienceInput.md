---
editUrl: false
next: false
prev: false
title: "PageExperienceInput"
---

> **PageExperienceInput** = `object`

## Properties

### allowedLatenessMs

> **allowedLatenessMs**: `number`

---

### completeThrough

> **completeThrough**: `string` \| `null`

Coverage is source evidence, not inferred from the last received event.

---

### coverage

> **coverage**: `"complete"` \| `"partial"` \| `"unknown"`

---

### cutoff

> **cutoff**: `string`

---

### definition

> **definition**: [`PageExperienceDefinition`](/api/metrics-core/src/type-aliases/pageexperiencedefinition/)

---

### deletedSubjects

> **deletedSubjects**: readonly `string`[]

---

### rows

> **rows**: readonly [`PageExperienceRow`](/api/metrics-core/src/type-aliases/pageexperiencerow/)[]

---

### scope

> **scope**: [`PageExperienceScope`](/api/metrics-core/src/type-aliases/pageexperiencescope/)

---

### snapshotRef

> **snapshotRef**: `string`

---

### sourceRef

> **sourceRef**: `string`

---

### sourceRevision

> **sourceRevision**: `string`

---

### window

> **window**: `object`

#### from

> **from**: `string`

#### to

> **to**: `string`
