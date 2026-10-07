---
editUrl: false
next: false
prev: false
title: "SavedIntentService"
---

## Methods

### deleteSubject()

> **deleteSubject**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

[`SavedIntentAccess`](/api/experience-core/src/type-aliases/savedintentaccess/)

#### Returns

`Promise`\<`void`\>

---

### listResumeCandidates()

> **listResumeCandidates**(`input`): `Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `availability`: `"available"` \| `"deleted"` \| `"denied"` \| `"expired"`; `intent`: [`SavedIntent`](/api/experience-core/src/type-aliases/savedintent/); `label?`: `string`; `rankReason`: `"recent"` \| `"pinned"`; `safeUrl?`: `string`; \}\>[]; `exclusions`: readonly `Readonly`\<\{ `intentId`: `string`; `reason`: `"completed"` \| `"removed"` \| `"retention"` \| `"duplicate"` \| `"display-limit"`; `resourceType`: `string`; \}\>[]; `nextOffset?`: `number`; \}\>\>

#### Parameters

##### input

`Readonly`\<\{ `principal`: `unknown`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `includeExclusions?`: `boolean`; `limit?`: `number`; `offset?`: `number`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `candidates`: readonly `Readonly`\<\{ `availability`: `"available"` \| `"deleted"` \| `"denied"` \| `"expired"`; `intent`: [`SavedIntent`](/api/experience-core/src/type-aliases/savedintent/); `label?`: `string`; `rankReason`: `"recent"` \| `"pinned"`; `safeUrl?`: `string`; \}\>[]; `exclusions`: readonly `Readonly`\<\{ `intentId`: `string`; `reason`: `"completed"` \| `"removed"` \| `"retention"` \| `"duplicate"` \| `"display-limit"`; `resourceType`: `string`; \}\>[]; `nextOffset?`: `number`; \}\>\>

---

### markCompleted()

> **markCompleted**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`MutateSavedIntentInput`](/api/experience-core/src/type-aliases/mutatesavedintentinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

---

### pinIntent()

> **pinIntent**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`MutateSavedIntentInput`](/api/experience-core/src/type-aliases/mutatesavedintentinput/) & `Readonly`\<\{ `pinOrder`: `number` \| `null`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

---

### purgeRetention()

> **purgeRetention**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

[`SavedIntentAccess`](/api/experience-core/src/type-aliases/savedintentaccess/)

#### Returns

`Promise`\<`void`\>

---

### readIntent()

> **readIntent**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

`Readonly`\<\{ `principal`: `unknown`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `resourceId`: `string`; `resourceType`: `string`; `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\> \| `undefined`\>

---

### readPolicy()

> **readPolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

`Readonly`\<\{ `principal`: `unknown`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `resourceType`: `string`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

---

### removeIntent()

> **removeIntent**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`MutateSavedIntentInput`](/api/experience-core/src/type-aliases/mutatesavedintentinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

---

### resolveIntent()

> **resolveIntent**(`input`): `Promise`\<`Readonly`\<\{ `availability`: `"available"` \| `"deleted"` \| `"denied"` \| `"expired"`; `intent`: [`SavedIntent`](/api/experience-core/src/type-aliases/savedintent/); `label?`: `string`; `rankReason`: `"recent"` \| `"pinned"`; `safeUrl?`: `string`; \}\>\>

#### Parameters

##### input

`Readonly`\<\{ `principal`: `unknown`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); \}\> & `Readonly`\<\{ `resourceId`: `string`; `resourceType`: `string`; `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `availability`: `"available"` \| `"deleted"` \| `"denied"` \| `"expired"`; `intent`: [`SavedIntent`](/api/experience-core/src/type-aliases/savedintent/); `label?`: `string`; `rankReason`: `"recent"` \| `"pinned"`; `safeUrl?`: `string`; \}\>\>

---

### saveIntent()

> **saveIntent**(`input`): `Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SaveIntentInput`](/api/experience-core/src/type-aliases/saveintentinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `id`: `string`; `lastUsedAt`: `string`; `pinOrder?`: `number`; `progressRef?`: `string`; `resourceId`: `string`; `resourceType`: `string`; `revision`: `number`; `savedAt`: `string`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `sourceKind`: [`SavedIntentSourceKind`](/api/experience-core/src/type-aliases/savedintentsourcekind/); `state`: `"saved"` \| `"completed"` \| `"removed"`; `subject`: [`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/); `updatedAt`: `string`; \}\>\>

---

### updatePolicy()

> **updatePolicy**(`input`): `Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>

#### Parameters

##### input

[`SavedIntentPolicyInput`](/api/experience-core/src/type-aliases/savedintentpolicyinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `actorId`: `string`; `displayLimit`: `number`; `excludeCompleted`: `boolean`; `reason`: `string`; `resourceType`: `string`; `retentionDays`: `number`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `updatedAt`: `string`; \}\>\>
