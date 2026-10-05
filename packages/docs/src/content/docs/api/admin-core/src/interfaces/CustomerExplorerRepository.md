---
editUrl: false
next: false
prev: false
title: "CustomerExplorerRepository"
---

## Methods

### createSample()

> **createSample**(`sample`): `Promise`\<`void`\>

#### Parameters

##### sample

[`Sample`](/api/admin-core/src/type-aliases/sample/)

#### Returns

`Promise`\<`void`\>

---

### deleteNote()

> **deleteNote**(`scope`, `sampleId`, `id`, `expectedRevision`, `actor`, `now`): `Promise`\<`void`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### id

`string`

##### expectedRevision

`number`

##### actor

`string`

##### now

`string`

#### Returns

`Promise`\<`void`\>

---

### deleteSample()

> **deleteSample**(`scope`, `id`): `Promise`\<`void`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### id

`string`

#### Returns

`Promise`\<`void`\>

---

### getSample()

> **getSample**(`scope`, `id`, `now`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\> \| `undefined`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### id

`string`

##### now

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\> \| `undefined`\>

---

### listNoteAudit()

> **listNoteAudit**(`scope`, `sampleId`): `Promise`\<readonly `Readonly`\<\{ `action`: `"delete"` \| `"save"`; `actor`: `string`; `at`: `string`; `noteId`: `string`; `revision`: `number`; \}\>[]\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `action`: `"delete"` \| `"save"`; `actor`: `string`; `at`: `string`; `noteId`: `string`; `revision`: `number`; \}\>[]\>

---

### listNotes()

> **listNotes**(`scope`, `sampleId`, `now`): `Promise`\<readonly `Readonly`\<\{ `author`: `string`; `eventRefs`: readonly `Readonly`\<\{ `eventId`: `string`; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `expiresAt`: `string`; `id`: `string`; `kind`: `"fact"` \| `"hypothesis"`; `revision`: `number`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); `text`: `string`; `updatedAt`: `string`; \}\>[]\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### now

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `author`: `string`; `eventRefs`: readonly `Readonly`\<\{ `eventId`: `string`; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `expiresAt`: `string`; `id`: `string`; `kind`: `"fact"` \| `"hypothesis"`; `revision`: `number`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); `text`: `string`; `updatedAt`: `string`; \}\>[]\>

---

### saveNote()

> **saveNote**(`note`, `expectedRevision`): `Promise`\<`void`\>

#### Parameters

##### note

[`ExplorerNote`](/api/admin-core/src/type-aliases/explorernote/)

##### expectedRevision

`number`

#### Returns

`Promise`\<`void`\>
