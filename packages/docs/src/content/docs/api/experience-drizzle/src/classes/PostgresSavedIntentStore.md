---
editUrl: false
next: false
prev: false
title: "PostgresSavedIntentStore"
---

Durable saved intent state. Every mutation serializes receipts and both resource sources.

## Implements

- [`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/)

## Constructors

### Constructor

> **new PostgresSavedIntentStore**(`database`): `PostgresSavedIntentStore`

#### Parameters

##### database

[`ExperiencePgDatabase`](/api/experience-drizzle/src/interfaces/experiencepgdatabase/)

#### Returns

`PostgresSavedIntentStore`

## Methods

### deleteSubject()

> **deleteSubject**(`input`): `Promise`\<`void`\>

Delete intents, suppression and idempotency receipts for this exact subject.

#### Parameters

##### input

`SubjectInput`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`deleteSubject`](/api/experience-core/src/interfaces/savedintentstore/#deletesubject)

---

### list()

> **list**(`input`): `Promise`\<readonly `Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>[]\>

#### Parameters

##### input

`Readonly`\<\{ `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `limit`: `number`; `offset`: `number`; \}\>

#### Returns

`Promise`\<readonly `Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>[]\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`list`](/api/experience-core/src/interfaces/savedintentstore/#list)

---

### mutate()

> **mutate**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SavedIntentMutation`](/api/experience-core/src/type-aliases/savedintentmutation/)

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`mutate`](/api/experience-core/src/interfaces/savedintentstore/#mutate)

---

### purgeExpired()

> **purgeExpired**(`input`): `Promise`\<`void`\>

Purge expired private rows and receipts; retain minimal resource suppression.

#### Parameters

##### input

`Readonly`\<\{ `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `before`: `string`; `resourceType`: `string`; \}\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`purgeExpired`](/api/experience-core/src/interfaces/savedintentstore/#purgeexpired)

---

### read()

> **read**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

`Pick`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>, `"scope"` \| `"subject"` \| `"resourceType"` \| `"resourceId"` \| `"sourceKind"`\>

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`read`](/api/experience-core/src/interfaces/savedintentstore/#read)

---

### readPolicy()

> **readPolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

`Readonly`\<\{ `resourceType`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`readPolicy`](/api/experience-core/src/interfaces/savedintentstore/#readpolicy)

---

### updatePolicy()

> **updatePolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SavedIntentPolicyMutation`](/api/experience-core/src/type-aliases/savedintentpolicymutation/)

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Implementation of

[`SavedIntentStore`](/api/experience-core/src/interfaces/savedintentstore/).[`updatePolicy`](/api/experience-core/src/interfaces/savedintentstore/#updatepolicy)
