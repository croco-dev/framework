---
editUrl: false
next: false
prev: false
title: "SurveyManager"
---

All clocks and identity/permission decisions belong to the server, never to a submitted body.

## Constructors

### Constructor

> **new SurveyManager**(`store`, `authority`, `tokens`, `targeting`, `triggers`, `clock?`): `SurveyManager`

#### Parameters

##### store

[`SurveyStore`](/api/research-core/src/interfaces/surveystore/)

##### authority

[`SurveyAuthority`](/api/research-core/src/interfaces/surveyauthority/)

##### tokens

[`SurveyTokenCodec`](/api/research-core/src/interfaces/surveytokencodec/)

##### targeting

[`SurveyTargeting`](/api/research-core/src/type-aliases/surveytargeting/)

##### triggers

readonly `string`[]

##### clock?

() => `Date`

#### Returns

`SurveyManager`

## Methods

### changeResponse()

> **changeResponse**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<`void`\>

---

### createInvitation()

> **createInvitation**(`input`): `Promise`\<\{ `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `invitationId`: `string`; `token`: `string`; \} \| `null`\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<\{ `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `invitationId`: `string`; `token`: `string`; \} \| `null`\>

---

### dismiss()

> **dismiss**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

`TokenInput`

#### Returns

`Promise`\<`void`\>

---

### evaluateEligibility()

> **evaluateEligibility**(`input`): `Promise`\<\{ `definition`: `Readonly`\<\{ `allowEdits`: `boolean`; `eligibility`: `string`; `endsAt`: `string`; `frequencyPolicy`: `Readonly`\<\{ `maxInvitations`: `number`; `windowMs`: `number`; \}\>; `id`: `string`; `questions`: readonly [`SurveyQuestion`](/api/research-core/src/type-aliases/surveyquestion/)[]; `retentionMs`: `number`; `startsAt`: `string`; `title`: `string`; `trigger`: `string`; `version`: `string`; \}\> \| `null`; `eligible`: `boolean`; `reason`: `string`; \}\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<\{ `definition`: `Readonly`\<\{ `allowEdits`: `boolean`; `eligibility`: `string`; `endsAt`: `string`; `frequencyPolicy`: `Readonly`\<\{ `maxInvitations`: `number`; `windowMs`: `number`; \}\>; `id`: `string`; `questions`: readonly [`SurveyQuestion`](/api/research-core/src/type-aliases/surveyquestion/)[]; `retentionMs`: `number`; `startsAt`: `string`; `title`: `string`; `trigger`: `string`; `version`: `string`; \}\> \| `null`; `eligible`: `boolean`; `reason`: `string`; \}\>

---

### expose()

> **expose**(`input`): `Promise`\<`Readonly`\<\{ `allowEdits`: `boolean`; `eligibility`: `string`; `endsAt`: `string`; `frequencyPolicy`: `Readonly`\<\{ `maxInvitations`: `number`; `windowMs`: `number`; \}\>; `id`: `string`; `questions`: readonly [`SurveyQuestion`](/api/research-core/src/type-aliases/surveyquestion/)[]; `retentionMs`: `number`; `startsAt`: `string`; `title`: `string`; `trigger`: `string`; `version`: `string`; \}\>\>

#### Parameters

##### input

`TokenInput`

#### Returns

`Promise`\<`Readonly`\<\{ `allowEdits`: `boolean`; `eligibility`: `string`; `endsAt`: `string`; `frequencyPolicy`: `Readonly`\<\{ `maxInvitations`: `number`; `windowMs`: `number`; \}\>; `id`: `string`; `questions`: readonly [`SurveyQuestion`](/api/research-core/src/type-aliases/surveyquestion/)[]; `retentionMs`: `number`; `startsAt`: `string`; `title`: `string`; `trigger`: `string`; `version`: `string`; \}\>\>

---

### publish()

> **publish**(`input`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `idempotencyKey`: `string`; `publishedAt`: `string`; `reason`: `string`; `revision`: `number`; \}\>\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`SurveyDefinition`](/api/research-core/src/type-aliases/surveydefinition/); `idempotencyKey`: `string`; `publishedAt`: `string`; `reason`: `string`; `revision`: `number`; \}\>\>

---

### rawResponses()

> **rawResponses**(`input`): `Promise`\<readonly `Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>[]\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>[]\>

---

### results()

> **results**(`input`): `Promise`\<\{ `denominator`: `number`; `denominatorKind`: `"invitation"` \| `"exposure"`; `dismissed`: `number`; `exposures`: `number`; `invitations`: `number`; `responseRate`: `number` \| `null`; `submitted`: `number`; `unanswered`: `number`; `unexposed`: `number`; \}\>

#### Parameters

##### input

`Context` & `object`

#### Returns

`Promise`\<\{ `denominator`: `number`; `denominatorKind`: `"invitation"` \| `"exposure"`; `dismissed`: `number`; `exposures`: `number`; `invitations`: `number`; `responseRate`: `number` \| `null`; `submitted`: `number`; `unanswered`: `number`; `unexposed`: `number`; \}\>

---

### submitResponse()

> **submitResponse**(`input`): `Promise`\<`Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>\>

#### Parameters

##### input

`Context` & `object` & `object`

#### Returns

`Promise`\<`Readonly`\<\{ `answers`: [`SurveyAnswers`](/api/research-core/src/type-aliases/surveyanswers/); `classification?`: `string`; `deletedAt?`: `string`; `familyId`: `string`; `id`: `string`; `idempotencyKey`: `string`; `invitationId`: `string`; `revision`: `number`; `submittedAt`: `string`; \}\>\>
