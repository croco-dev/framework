---
editUrl: false
next: false
prev: false
title: "PageExperienceReport"
---

> **PageExperienceReport** = `object`

## Properties

### allowedLatenessMs

> **allowedLatenessMs**: `number`

---

### attempted

> **attempted**: [`PageExperienceRatio`](/api/metrics-core/src/type-aliases/pageexperienceratio/)

---

### bounce

> **bounce**: [`PageExperienceRatio`](/api/metrics-core/src/type-aliases/pageexperienceratio/)

---

### committed

> **committed**: [`PageExperienceRatio`](/api/metrics-core/src/type-aliases/pageexperienceratio/)

---

### completeSessions

> **completeSessions**: `number`

---

### confirmedOutcomes

> **confirmedOutcomes**: `number`

Confirmed outcomes remain visible even without a linked browser event.

---

### coverage

> **coverage**: [`PageExperienceInput`](/api/metrics-core/src/type-aliases/pageexperienceinput/)\[`"coverage"`\]

---

### cutoff

> **cutoff**: `string`

---

### definition

> **definition**: [`PageExperienceDefinition`](/api/metrics-core/src/type-aliases/pageexperiencedefinition/)

---

### definitionHash

> **definitionHash**: `string`

---

### diagnostics

> **diagnostics**: readonly `string`[]

---

### engaged

> **engaged**: [`PageExperienceRatio`](/api/metrics-core/src/type-aliases/pageexperienceratio/)

---

### inputHash

> **inputHash**: `string`

---

### invalidInstances

> **invalidInstances**: `number`

Page instances excluded for contradictory browser sequences; confirmed receipts remain outcomes.

---

### lateRows

> **lateRows**: `number`

---

### openSessions

> **openSessions**: `number`

---

### orphanRows

> **orphanRows**: `number`

Rows excluded from the funnel because their session is absent or outside its declared window.

---

### revision

> **revision**: `string`

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

### unit

> **unit**: [`PageExperienceDefinition`](/api/metrics-core/src/type-aliases/pageexperiencedefinition/)\[`"unit"`\]

---

### unknownSessions

> **unknownSessions**: `number`

---

### unlinkedCommitted

> **unlinkedCommitted**: `number`

---

### viewed

> **viewed**: `number`

---

### window

> **window**: [`PageExperienceInput`](/api/metrics-core/src/type-aliases/pageexperienceinput/)\[`"window"`\]
