---
editUrl: false
next: false
prev: false
title: "PlanReleaseValidationEvidence"
---

> **PlanReleaseValidationEvidence** = `object`

ContractGraph evidence whose planVersionRef, definitionFingerprint, draftRevision, graphVersion,
snapshotId, and checkedAt bindings are verified locally without re-running validation.

## Properties

### checkedAt

> `readonly` **checkedAt**: `string`

---

### definitionFingerprint

> `readonly` **definitionFingerprint**: `string`

---

### diagnostics

> `readonly` **diagnostics**: readonly [`PlanReleaseValidationDiagnostic`](/api/billing-core/src/type-aliases/planreleasevalidationdiagnostic/)[]

---

### draftRevision

> `readonly` **draftRevision**: `number`

---

### graphVersion

> `readonly` **graphVersion**: `string`

---

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

---

### snapshotId

> `readonly` **snapshotId**: `string`
