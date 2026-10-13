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

> **resolve**(`reference`, `access`): `Promise`\<[`LearningEvidenceResult`](/api/admin-core/src/type-aliases/learningevidenceresult/)\>

Reauthorize against current source privacy, including retained snapshots. No default URL fetch.

#### Parameters

##### reference

[`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/)

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<[`LearningEvidenceResult`](/api/admin-core/src/type-aliases/learningevidenceresult/)\>
