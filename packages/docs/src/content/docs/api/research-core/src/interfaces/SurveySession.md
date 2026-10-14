---
editUrl: false
next: false
prev: false
title: "SurveySession"
---

## Methods

### counts()

> **counts**(`familyId`): `Promise`\<\{ `dismissed`: `number`; `exposures`: `number`; `invitations`: `number`; `submitted`: `number`; \}\>

#### Parameters

##### familyId

`string`

#### Returns

`Promise`\<\{ `dismissed`: `number`; `exposures`: `number`; `invitations`: `number`; `submitted`: `number`; \}\>

---

### eraseAnswers()

> **eraseAnswers**(`invitationId`, `at`): `Promise`\<`void`\>

#### Parameters

##### invitationId

`string`

##### at

`string`

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`kind`, `id`): `Promise`\<[`SurveyRecord`](/api/research-core/src/type-aliases/surveyrecord/) \| `null`\>

#### Parameters

##### kind

`"invitation"` \| `"definition"` \| `"response"` \| `"audit"`

##### id

`string`

#### Returns

`Promise`\<[`SurveyRecord`](/api/research-core/src/type-aliases/surveyrecord/) \| `null`\>

---

### invitations()

> **invitations**(`familyId`, `subject`, `since`): `Promise`\<`number`\>

#### Parameters

##### familyId

`string`

##### subject

[`SurveySubject`](/api/research-core/src/type-aliases/surveysubject/)

##### since

`string`

#### Returns

`Promise`\<`number`\>

---

### latest()

> **latest**(`familyId`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `idempotencyKey`: `string`; `publishedAt`: `string`; `reason`: `string`; `revision`: `number`; \}\> \| `null`\>

#### Parameters

##### familyId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `idempotencyKey`: `string`; `publishedAt`: `string`; `reason`: `string`; `revision`: `number`; \}\> \| `null`\>

---

### put()

> **put**(`record`): `Promise`\<`void`\>

#### Parameters

##### record

[`SurveyRecord`](/api/research-core/src/type-aliases/surveyrecord/)

#### Returns

`Promise`\<`void`\>

---

### responses()

> **responses**(`familyId`, `after`, `limit`): `Promise`\<readonly `Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>[]\>

#### Parameters

##### familyId

`string`

##### after

`string`

##### limit

`number`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>[]\>
