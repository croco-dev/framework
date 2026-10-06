---
editUrl: false
next: false
prev: false
title: "createCustomerExplorerSample"
---

> **createCustomerExplorerSample**(`query`, `population`, `metadata`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

## Parameters

### query

[`SampleQuery`](/api/admin-core/src/type-aliases/samplequery/)

### population

[`ExplorerPopulation`](/api/admin-core/src/type-aliases/explorerpopulation/)

### metadata

`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `expiresAt`: `string`; `id`: `string`; \}\>

## Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>
