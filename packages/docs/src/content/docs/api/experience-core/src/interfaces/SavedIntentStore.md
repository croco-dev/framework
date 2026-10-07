---
editUrl: false
next: false
prev: false
title: "SavedIntentStore"
---

Implement atomically: receipt equality, resource suppression, unique key and revision CAS.

## Methods

### deleteSubject()

> **deleteSubject**(`input`): `Promise`\<`void`\>

Delete intents, suppression and idempotency receipts for this exact subject.

#### Parameters

##### input

`Readonly`\<\{ `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\>

#### Returns

`Promise`\<`void`\>

---

### list()

> **list**(`input`): `Promise`\<readonly `Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>[]\>

#### Parameters

##### input

`Readonly`\<\{ `limit`: `number`; `offset`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\>

#### Returns

`Promise`\<readonly `Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>[]\>

---

### mutate()

> **mutate**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SavedIntentMutation`](/api/experience-core/src/type-aliases/savedintentmutation/)

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

---

### purgeExpired()

> **purgeExpired**(`input`): `Promise`\<`void`\>

Purge expired private rows and receipts; retain minimal resource suppression.

#### Parameters

##### input

`Readonly`\<\{ `before`: `string`; `resourceType`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\>

#### Returns

`Promise`\<`void`\>

---

### read()

> **read**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

`Pick`\<[`SavedIntent`](/api/experience-core/src/type-aliases/savedintent/), `"scope"` \| `"subject"` \| `"resourceType"` \| `"resourceId"` \| `"sourceKind"`\>

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

---

### readPolicy()

> **readPolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

`Readonly`\<\{ `resourceType`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\> \| `undefined`\>

---

### updatePolicy()

> **updatePolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SavedIntentPolicyMutation`](/api/experience-core/src/type-aliases/savedintentpolicymutation/)

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>
