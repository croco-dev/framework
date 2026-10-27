---
editUrl: false
next: false
prev: false
title: "PostgresExperienceStore"
---

PostgreSQL adapter for a Drizzle node-postgres execute/transaction boundary.

## Implements

- [`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/)

## Constructors

### Constructor

> **new PostgresExperienceStore**(`database`): `PostgresExperienceStore`

#### Parameters

##### database

[`ExperiencePgDatabase`](/api/experience-drizzle/src/interfaces/experiencepgdatabase/)

#### Returns

`PostgresExperienceStore`

## Methods

### dismiss()

> **dismiss**(`input`): `Promise`\<`void`\>

#### Parameters

##### input

[`ExperienceReceiptInput`](/api/experience-core/src/type-aliases/experiencereceiptinput/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`dismiss`](/api/experience-core/src/interfaces/experiencestore/#dismiss)

---

### getConfig()

> **getConfig**(`scope`, `placementId`, `configId`): `Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\> \| `undefined`\>

#### Parameters

##### scope

[`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/)

##### placementId

`string`

##### configId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\> \| `undefined`\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`getConfig`](/api/experience-core/src/interfaces/experiencestore/#getconfig)

---

### listConfigs()

> **listConfigs**(`scope`, `placementId`, `query?`): `Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

Ordered by id; default/maximum page size 100. Continue after the last returned id until empty.

#### Parameters

##### scope

[`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/)

##### placementId

`string`

##### query?

[`ExperienceConfigQuery`](/api/experience-core/src/type-aliases/experienceconfigquery/) = `{}`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`listConfigs`](/api/experience-core/src/interfaces/experiencestore/#listconfigs)

---

### listPublishedConfigs()

> **listPublishedConfigs**(`scope`, `placementId`): `Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

Complete published candidate set; reject overflow rather than silently truncate.

#### Parameters

##### scope

[`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/)

##### placementId

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`listPublishedConfigs`](/api/experience-core/src/interfaces/experiencestore/#listpublishedconfigs)

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

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`readDecision`](/api/experience-core/src/interfaces/experiencestore/#readdecision)

---

### recordExposure()

> **recordExposure**(`input`): `Promise`\<`"recorded"` \| `"duplicate"`\>

#### Parameters

##### input

[`ExperienceReceiptInput`](/api/experience-core/src/type-aliases/experiencereceiptinput/)

#### Returns

`Promise`\<`"recorded"` \| `"duplicate"`\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`recordExposure`](/api/experience-core/src/interfaces/experiencestore/#recordexposure)

---

### reserve()

> **reserve**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

[`ExperienceReserveInput`](/api/experience-core/src/type-aliases/experiencereserveinput/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`reserve`](/api/experience-core/src/interfaces/experiencestore/#reserve)

---

### saveConfig()

> **saveConfig**(`input`): `Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>

#### Parameters

##### input

[`ExperienceSaveInput`](/api/experience-core/src/type-aliases/experiencesaveinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"draft"` \| `"published"` \| `"paused"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>

#### Implementation of

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/).[`saveConfig`](/api/experience-core/src/interfaces/experiencestore/#saveconfig)
