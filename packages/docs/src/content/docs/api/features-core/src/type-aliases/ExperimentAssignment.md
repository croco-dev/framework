---
editUrl: false
next: false
prev: false
title: "ExperimentAssignment"
---

> **ExperimentAssignment** = [`ExperimentTarget`](/api/features-core/src/type-aliases/experimenttarget/) & `object`

## Type Declaration

### assignedAt

> `readonly` **assignedAt**: `string`

### eligibilitySnapshotRef?

> `readonly` `optional` **eligibilitySnapshotRef?**: [`ExperimentSnapshotReference`](/api/features-core/src/type-aliases/experimentsnapshotreference/)

### id

> `readonly` **id**: `string`

### providerRef?

> `readonly` `optional` **providerRef?**: `Readonly`\<`Record`\<`string`, `string`\>\>

### subject

> `readonly` **subject**: [`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/)

### value

> `readonly` **value**: `string` \| `boolean` \| `number`

### variant

> `readonly` **variant**: `string`
