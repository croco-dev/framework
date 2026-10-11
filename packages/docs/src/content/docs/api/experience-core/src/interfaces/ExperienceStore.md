---
editUrl: false
next: false
prev: false
title: "ExperienceStore"
---

## Methods

### dismiss()

> **dismiss**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

[`ExperienceReceiptInput`](/api/experience-core/src/type-aliases/experiencereceiptinput/)

#### Returns

`Promise`\<`void`\>

---

### listConfigs()

> **listConfigs**(`scope`, `placementId`): `Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

#### Parameters

##### scope

[`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/)

##### placementId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

---

### readDecision()

> **readDecision**(`scope`, `decisionId`): `Promise`\<`Readonly`\<\{ `decision`: [`ExperienceDecision`](/api/experience-core/src/type-aliases/experiencedecision/); `handle`: [`ExposureHandle`](/api/experience-core/src/type-aliases/exposurehandle/); \}\> \| `undefined`\>

#### Parameters

##### scope

[`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/)

##### decisionId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `decision`: [`ExperienceDecision`](/api/experience-core/src/type-aliases/experiencedecision/); `handle`: [`ExposureHandle`](/api/experience-core/src/type-aliases/exposurehandle/); \}\> \| `undefined`\>

---

### recordExposure()

> **recordExposure**(`input`): `Promise`\<`"duplicate"` \| `"recorded"`\>

#### Parameters

##### input

[`ExperienceReceiptInput`](/api/experience-core/src/type-aliases/experiencereceiptinput/)

#### Returns

`Promise`\<`"duplicate"` \| `"recorded"`\>

---

### reserve()

> **reserve**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

[`ExperienceReserveInput`](/api/experience-core/src/type-aliases/experiencereserveinput/)

#### Returns

`Promise`\<`boolean`\>

---

### saveConfig()

> **saveConfig**(`input`): `Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>

#### Parameters

##### input

[`ExperienceSaveInput`](/api/experience-core/src/type-aliases/experiencesaveinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>
