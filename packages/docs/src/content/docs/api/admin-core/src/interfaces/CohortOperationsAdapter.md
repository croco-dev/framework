---
editUrl: false
next: false
prev: false
title: "CohortOperationsAdapter"
---

Implementations enforce access on the server and return only authorized, masked explanations.

## Methods

### explain()

> **explain**(`request`, `access`): `Promise`\<`Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>\>

#### Parameters

##### request

[`CohortExplainRequest`](/api/admin-core/src/type-aliases/cohortexplainrequest/)

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>\>

---

### history()

> **history**(`definition`, `access`): `Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `memberCount`: `number`; `reason`: `string`; `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); \}\>[]\>

#### Parameters

##### definition

[`CohortDefinition`](/api/cohort-core/src/type-aliases/cohortdefinition/)

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<readonly `Readonly`\<\{ `actor`: `string`; `memberCount`: `number`; `reason`: `string`; `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); \}\>[]\>

---

### preview()

> **preview**(`request`, `access`): `Promise`\<`Readonly`\<\{ `matched`: `number`; `previousMatched?`: `number`; `run`: [`CohortRun`](/api/cohort-core/src/type-aliases/cohortrun/); `sample`: readonly `Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>[]; `total`: `number`; `unknown`: `number`; \}\>\>

#### Parameters

##### request

[`CohortPreviewRequest`](/api/admin-core/src/type-aliases/cohortpreviewrequest/)

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `matched`: `number`; `previousMatched?`: `number`; `run`: [`CohortRun`](/api/cohort-core/src/type-aliases/cohortrun/); `sample`: readonly `Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>[]; `total`: `number`; `unknown`: `number`; \}\>\>

---

### publish()

> **publish**(`request`, `access`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `memberCount`: `number`; `reason`: `string`; `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); \}\>\>

#### Parameters

##### request

[`CohortPublishRequest`](/api/admin-core/src/type-aliases/cohortpublishrequest/)

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `memberCount`: `number`; `reason`: `string`; `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); \}\>\>

---

### registration()

> **registration**(`access`): `Promise`\<`Readonly`\<\{ `events`: readonly `string`[]; `fields`: `Readonly`\<`Record`\<`string`, [`CohortFieldRegistration`](/api/cohort-core/src/type-aliases/cohortfieldregistration/)\>\>; `memberships`: readonly `string`[]; \}\>\>

#### Parameters

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `events`: readonly `string`[]; `fields`: `Readonly`\<`Record`\<`string`, [`CohortFieldRegistration`](/api/cohort-core/src/type-aliases/cohortfieldregistration/)\>\>; `memberships`: readonly `string`[]; \}\>\>

---

### run()

> **run**(`request`, `access`): `Promise`\<`Readonly`\<\{ `asOf`: `string`; `definitionVersion`: `number`; `id`: `string`; `sourceSnapshotRefs`: readonly `string`[]; `sourceWatermarks`: `Readonly`\<`Record`\<`string`, `string`\>\>; `status`: `"complete"` \| `"canceled"` \| `"running"` \| `"failed"` \| `"queued"`; \}\>\>

#### Parameters

##### request

[`CohortRunRequest`](/api/admin-core/src/type-aliases/cohortrunrequest/)

##### access

[`CohortAdminAccess`](/api/admin-core/src/type-aliases/cohortadminaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `asOf`: `string`; `definitionVersion`: `number`; `id`: `string`; `sourceSnapshotRefs`: readonly `string`[]; `sourceWatermarks`: `Readonly`\<`Record`\<`string`, `string`\>\>; `status`: `"complete"` \| `"canceled"` \| `"running"` \| `"failed"` \| `"queued"`; \}\>\>
