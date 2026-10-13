---
editUrl: false
next: false
prev: false
title: "LearningEvidenceSource"
---

## Properties

### id

> `readonly` **id**: `string`

## Methods

### resolve()

> **resolve**(`reference`, `access`): `Promise`\<`Readonly`\<\{ `state`: `"available"` \| `"denied"` \| `"failed"` \| `"deleted"`; `version?`: `string`; \}\>\>

Reauthorize against current source privacy, including retained snapshots. No default URL fetch.

#### Parameters

##### reference

[`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/)

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `state`: `"available"` \| `"denied"` \| `"failed"` \| `"deleted"`; `version?`: `string`; \}\>\>
