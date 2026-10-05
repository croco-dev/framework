---
editUrl: false
next: false
prev: false
title: "PostgresCustomerExplorerRepository"
---

## Implements

- [`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/)

## Constructors

### Constructor

> **new PostgresCustomerExplorerRepository**(`database`): `PostgresCustomerExplorerRepository`

#### Parameters

##### database

[`ExplorerPgDatabase`](/api/admin-ops/src/interfaces/explorerpgdatabase/)

#### Returns

`PostgresCustomerExplorerRepository`

## Methods

### createSample()

> **createSample**(`sample`): `Promise`\<`void`\>

#### Parameters

##### sample

[`Sample`](/api/admin-core/src/type-aliases/sample/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`createSample`](/api/admin-core/src/interfaces/customerexplorerrepository/#createsample)

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

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`deleteNote`](/api/admin-core/src/interfaces/customerexplorerrepository/#deletenote)

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

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`deleteSample`](/api/admin-core/src/interfaces/customerexplorerrepository/#deletesample)

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

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`getSample`](/api/admin-core/src/interfaces/customerexplorerrepository/#getsample)

---

### listNoteAudit()

> **listNoteAudit**(`scope`, `sampleId`): `Promise`\<readonly `Readonly`\<\{ `action`: `"save"` \| `"delete"`; `actor`: `string`; `at`: `string`; `noteId`: `string`; `revision`: `number`; \}\>[]\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### sampleId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `action`: `"save"` \| `"delete"`; `actor`: `string`; `at`: `string`; `noteId`: `string`; `revision`: `number`; \}\>[]\>

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`listNoteAudit`](/api/admin-core/src/interfaces/customerexplorerrepository/#listnoteaudit)

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

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`listNotes`](/api/admin-core/src/interfaces/customerexplorerrepository/#listnotes)

---

### purgeExpired()

> **purgeExpired**(`scope`, `now`): `Promise`\<`number`\>

#### Parameters

##### scope

[`ExplorerScope`](/api/admin-core/src/type-aliases/explorerscope/)

##### now

`string`

#### Returns

`Promise`\<`number`\>

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

#### Implementation of

[`CustomerExplorerRepository`](/api/admin-core/src/interfaces/customerexplorerrepository/).[`saveNote`](/api/admin-core/src/interfaces/customerexplorerrepository/#savenote)
