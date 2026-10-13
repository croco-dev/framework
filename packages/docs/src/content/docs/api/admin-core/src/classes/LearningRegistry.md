---
editUrl: false
next: false
prev: false
title: "LearningRegistry"
---

## Constructors

### Constructor

> **new LearningRegistry**(`repository`, `policy`, `sources?`, `now?`): `LearningRegistry`

#### Parameters

##### repository

[`LearningRepository`](/api/admin-core/src/interfaces/learningrepository/)

##### policy

[`LearningPolicy`](/api/admin-core/src/interfaces/learningpolicy/)

##### sources?

readonly [`LearningEvidenceSource`](/api/admin-core/src/interfaces/learningevidencesource/)[] = `[]`

##### now?

() => `string`

#### Returns

`LearningRegistry`

## Methods

### copyDraft()

> **copyDraft**(`scope`, `id`, `newId`, `access`): `Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### newId

`string`

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<[`LearningRecord`](/api/admin-core/src/type-aliases/learningrecord/)\>

---

### export()

> **export**(`scope`, `id`, `access`, `permission?`): `Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

No cached source bodies or customer logs. Consumers must reauthorize retained exports.

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

##### permission?

`"export"` \| `"share"`

#### Returns

`Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

---

### history()

> **history**(`scope`, `id`, `access`, `before?`): `Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `view`: [`LearningView`](/api/admin-core/src/type-aliases/learningview/); \}\>[]\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

##### before?

`number`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `at`: `string`; `reason`: `string`; `view`: [`LearningView`](/api/admin-core/src/type-aliases/learningview/); \}\>[]\>

---

### read()

> **read**(`scope`, `id`, `access`): `Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### id

`string`

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

---

### save()

> **save**(`input`, `access`): `Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

#### Parameters

##### input

[`LearningMutation`](/api/admin-core/src/type-aliases/learningmutation/)

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>\>

---

### search()

> **search**(`scope`, `query`, `access`): `Promise`\<`Readonly`\<\{ `nextAfter?`: `string`; `rows`: readonly `Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>[]; \}\>\>

#### Parameters

##### scope

[`LearningScope`](/api/admin-core/src/type-aliases/learningscope/)

##### query

[`LearningQuery`](/api/admin-core/src/type-aliases/learningquery/)

##### access

[`LearningAccess`](/api/admin-core/src/type-aliases/learningaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `nextAfter?`: `string`; `rows`: readonly `Readonly`\<\{ `content`: `Partial`\<[`LearningContent`](/api/admin-core/src/type-aliases/learningcontent/)\>; `evidence`: readonly `Readonly`\<\{ `accessState`: [`EvidenceAccessState`](/api/admin-core/src/type-aliases/evidenceaccessstate/); `reference`: [`EvidenceRef`](/api/admin-core/src/type-aliases/evidenceref/); \}\>[]; `hasLearning`: `boolean`; `id`: `string`; `revision`: `number`; `scope`: [`LearningScope`](/api/admin-core/src/type-aliases/learningscope/); \}\>[]; \}\>\>
