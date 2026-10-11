---
editUrl: false
next: false
prev: false
title: "CustomerExplorerService"
---

## Constructors

### Constructor

> **new CustomerExplorerService**(`options`): `CustomerExplorerService`

#### Parameters

##### options

[`CustomerExplorerOptions`](/api/admin-core/src/type-aliases/customerexploreroptions/)

#### Returns

`CustomerExplorerService`

## Methods

### deleteNote()

> **deleteNote**(`scope`, `sampleId`, `id`, `expectedRevision`): `Promise`\<`void`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### id

`string`

##### expectedRevision

`number`

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

### exportDraft()

> **exportDraft**(`scope`, `sampleId`, `conditions`): `Promise`\<`Readonly`\<\{ `conditions`: readonly `Readonly`\<\{ `kind`: `string`; `phase`: `"before"` \| `"anchor"` \| `"after"`; `source`: `string`; \}\>[]; `populationSnapshotId`: `string`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `version`: `1`; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### conditions

readonly `Readonly`\<\{ `kind`: `string`; `phase`: `"before"` \| `"anchor"` \| `"after"`; `source`: `string`; \}\>[]

#### Returns

`Promise`\<`Readonly`\<\{ `conditions`: readonly `Readonly`\<\{ `kind`: `string`; `phase`: `"before"` \| `"anchor"` \| `"after"`; `source`: `string`; \}\>[]; `populationSnapshotId`: `string`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `version`: `1`; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

---

### getSample()

> **getSample**(`scope`, `id`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### id

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

---

### notes()

> **notes**(`scope`, `sampleId`): `Promise`\<readonly [`ExplorerResolvedNote`](/api/admin-core/src/type-aliases/explorerresolvednote/)[]\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

#### Returns

`Promise`\<readonly [`ExplorerResolvedNote`](/api/admin-core/src/type-aliases/explorerresolvednote/)[]\>

---

### sample()

> **sample**(`query`, `population`, `metadata`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

#### Parameters

##### query

[`SampleQuery`](/api/admin-core/src/type-aliases/samplequery/)

##### population

[`ExplorerPopulation`](/api/admin-core/src/type-aliases/explorerpopulation/)

##### metadata

`Readonly`\<\{ `expiresAt`: `string`; `id`: `string`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `createdAt`: `string`; `excludedN`: `number`; `expiresAt`: `string`; `id`: `string`; `ordering`: `"occurredAt/source/eventId"`; `populationDigest`: `string`; `populationSnapshotId`: `string`; `sampledSubjects`: readonly `Readonly`\<\{ `anchorAt`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `seed`: `string`; `targetDefinition`: `Readonly`\<\{ `description`: `string`; `id`: `string`; `revision`: `number`; \}\>; `window`: `Readonly`\<\{ `afterMs`: `number`; `beforeMs`: `number`; \}\>; \}\>\>

---

### saveNote()

> **saveNote**(`scope`, `sampleId`, `input`): `Promise`\<`Readonly`\<\{ `author`: `string`; `eventRefs`: readonly `Readonly`\<\{ `eventId`: `string`; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `expiresAt`: `string`; `id`: `string`; `kind`: `"fact"` \| `"hypothesis"`; `revision`: `number`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); `text`: `string`; `updatedAt`: `string`; \}\>\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### input

[`ExplorerNoteInput`](/api/admin-core/src/type-aliases/explorernoteinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `author`: `string`; `eventRefs`: readonly `Readonly`\<\{ `eventId`: `string`; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\>[]; `expiresAt`: `string`; `id`: `string`; `kind`: `"fact"` \| `"hypothesis"`; `revision`: `number`; `sampleId`: `string`; `scope`: [`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/); `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); `text`: `string`; `updatedAt`: `string`; \}\>\>

---

### timeline()

> **timeline**(`scope`, `sampleId`, `subject`, `options?`): `Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `nextCursors`: `Readonly`\<`Record`\<`string`, `string`\>\>; `sources`: readonly `Readonly`\<\{ `source`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>[]; \}\>\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

##### subject

[`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/)

##### options?

`Readonly`\<\{ `cursors?`: `Readonly`\<`Record`\<`string`, `string`\>\>; `limit?`: `number`; \}\> = `{}`

#### Returns

`Promise`\<`Readonly`\<\{ `items`: readonly `Readonly`\<\{ `completeness`: `"complete"` \| `"partial"` \| `"delayed"`; `eventId`: `string`; `kind`: `string`; `objectRef?`: `string`; `observedAt`: `string`; `occurredAt`: `string`; `safeProperties`: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean` \| `null`\>\>; `source`: `string`; `subject`: [`ExplorerSubject`](/api/admin-core/src/type-aliases/explorersubject/); \}\> & `object`[]; `nextCursors`: `Readonly`\<`Record`\<`string`, `string`\>\>; `sources`: readonly `Readonly`\<\{ `source`: `string`; `status`: [`ExplorerSourceStatus`](/api/admin-core/src/type-aliases/explorersourcestatus/); `truncated`: `boolean`; \}\>[]; \}\>\>
