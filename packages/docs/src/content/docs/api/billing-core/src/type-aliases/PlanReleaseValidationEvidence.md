---
editUrl: false
next: false
prev: false
title: "PlanReleaseValidationEvidence"
---

> **PlanReleaseValidationEvidence** = `object`

A caller-supplied snapshot produced by ContractGraph validation; this package never re-verifies it.

## Properties

### checkedAt

> `readonly` **checkedAt**: `string`

***

### definitionFingerprint

> `readonly` **definitionFingerprint**: `string`

***

### diagnostics

> `readonly` **diagnostics**: readonly [`PlanReleaseValidationDiagnostic`](/api/billing-core/src/type-aliases/planreleasevalidationdiagnostic/)[]

***

### draftRevision

> `readonly` **draftRevision**: `number`

***

### graphVersion

> `readonly` **graphVersion**: `string`

***

### planVersionRef

> `readonly` **planVersionRef**: [`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

***

### snapshotId

> `readonly` **snapshotId**: `string`
