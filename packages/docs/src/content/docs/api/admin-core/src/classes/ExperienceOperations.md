---
editUrl: false
next: false
prev: false
title: "ExperienceOperations"
---

Server boundary for scoped reads, previews, and audited configuration changes.

## Constructors

### Constructor

> **new ExperienceOperations**(`store`, `placements`, `cohortReader?`): `ExperienceOperations`

#### Parameters

##### store

[`ExperienceStore`](/api/experience-core/src/interfaces/experiencestore/)

##### placements

`Readonly`\<`Record`\<`string`, [`PlacementDefinition`](/api/experience-core/src/type-aliases/placementdefinition/)\>\>

##### cohortReader?

[`PublishedCohortReader`](/api/cohort-core/src/classes/publishedcohortreader/)

#### Returns

`ExperienceOperations`

## Methods

### list()

> **list**(`placementId`, `access`): `Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"paused"` \| `"draft"` \| `"published"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

#### Parameters

##### placementId

`string`

##### access

[`ExperienceAdminAccess`](/api/admin-core/src/type-aliases/experienceadminaccess/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"paused"` \| `"draft"` \| `"published"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>[]\>

---

### preview()

> **preview**(`config`, `subject`, `context`, `access`, `now?`): `Promise`\<`Readonly`\<\{ `content`: `Readonly`\<\{ `actionUrl?`: `string`; `body`: `string`; `locale`: `string`; `title`: `string`; \}\>; `matched`: `boolean`; `renderer`: `string`; `sourceSnapshotId?`: `string`; \}\>\>

#### Parameters

##### config

[`ExperienceConfig`](/api/experience-core/src/type-aliases/experienceconfig/)

##### subject

[`ExperienceSubject`](/api/experience-core/src/type-aliases/experiencesubject/)

##### context

[`ExperienceContext`](/api/experience-core/src/type-aliases/experiencecontext/)

##### access

[`ExperienceAdminAccess`](/api/admin-core/src/type-aliases/experienceadminaccess/)

##### now?

`Date` = `...`

#### Returns

`Promise`\<`Readonly`\<\{ `content`: `Readonly`\<\{ `actionUrl?`: `string`; `body`: `string`; `locale`: `string`; `title`: `string`; \}\>; `matched`: `boolean`; `renderer`: `string`; `sourceSnapshotId?`: `string`; \}\>\>

---

### save()

> **save**(`config`, `access`, `input`): `Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"paused"` \| `"draft"` \| `"published"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>

#### Parameters

##### config

[`ExperienceConfig`](/api/experience-core/src/type-aliases/experienceconfig/)

##### access

[`ExperienceAdminAccess`](/api/admin-core/src/type-aliases/experienceadminaccess/)

##### input

`Readonly`\<\{ `expectedRevision`: `number` \| `null`; `idempotencyKey`: `string`; `reason`: `string`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `content`: [`ExperienceContent`](/api/experience-core/src/type-aliases/experiencecontent/); `endAt?`: `string`; `frequency?`: `Readonly`\<\{ `maxDisplays`: `number`; `windowSeconds`: `number`; \}\>; `id`: `string`; `placementId`: `string`; `priority`: `number`; `renderer`: `string`; `revision`: `number`; `scope`: [`ExperienceScope`](/api/experience-core/src/type-aliases/experiencescope/); `startAt?`: `string`; `status`: `"paused"` \| `"draft"` \| `"published"` \| `"archived"`; `targeting?`: `Readonly`\<\{ `cohortSnapshotId?`: `string`; `context?`: readonly [`ExperienceContextPredicate`](/api/experience-core/src/type-aliases/experiencecontextpredicate/)[]; `staticSubjectIds?`: readonly `string`[]; \}\>; \}\>\>
