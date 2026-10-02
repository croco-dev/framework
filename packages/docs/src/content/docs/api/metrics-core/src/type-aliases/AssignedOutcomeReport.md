---
editUrl: false
next: false
prev: false
title: "AssignedOutcomeReport"
---

> **AssignedOutcomeReport** = `object`

## Properties

### assignmentSnapshot

> **assignmentSnapshot**: [`AssignmentSnapshot`](/api/metrics-core/src/type-aliases/assignmentsnapshot/)

---

### byCurrency

> **byCurrency**: `object`[]

#### arms

> **arms**: [`AssignedOutcomeArm`](/api/metrics-core/src/type-aliases/assignedoutcomearm/)[]

#### currency

> **currency**: `string`

#### delta

> **delta**: `object`[]

---

### costCompleteness

> **costCompleteness**: readonly [`OutcomeCostCompleteness`](/api/metrics-core/src/type-aliases/outcomecostcompleteness/)[]

---

### counts

> **counts**: `object`

#### accepted

> **accepted**: `number`

#### duplicates

> **duplicates**: `number`

#### excludedByCutoff

> **excludedByCutoff**: `number`

#### received

> **received**: `number`

#### rejected

> **rejected**: `number`

#### superseded

> **superseded**: `number`

---

### cutoff

> **cutoff**: [`OutcomeCutoff`](/api/metrics-core/src/type-aliases/outcomecutoff/)

---

### definitionHash

> **definitionHash**: `string`

---

### diagnostics

> **diagnostics**: [`OutcomeDiagnostic`](/api/metrics-core/src/type-aliases/outcomediagnostic/)[]

---

### inputHash

> **inputHash**: `string`

---

### metricDefinitionVersion

> **metricDefinitionVersion**: `string`

---

### quality

> **quality**: `"complete"` \| `"partial"`

---

### revision

> **revision**: `string`

---

### sources

> **sources**: readonly `string`[]
