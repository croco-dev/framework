---
editUrl: false
next: false
prev: false
title: "PostgresCohortStore"
---

PostgreSQL adapter; supports the execute/transaction surface of Drizzle's node-postgres driver.

## Implements

- [`CohortPublicationStore`](/api/cohort-core/src/interfaces/cohortpublicationstore/)

## Constructors

### Constructor

> **new PostgresCohortStore**(`database`): `PostgresCohortStore`

#### Parameters

##### database

[`CohortPgDatabase`](/api/cohort-drizzle/src/interfaces/cohortpgdatabase/)

#### Returns

`PostgresCohortStore`

## Methods

### checkpoint()

> **checkpoint**(`runId`, `scope`): `Promise`\<`Readonly`\<\{ `after`: `string` \| `null`; `revision`: `number`; `run`: [`CohortRun`](/api/cohort-core/src/type-aliases/cohortrun/); \}\>\>

#### Parameters

##### runId

`string`

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

#### Returns

`Promise`\<`Readonly`\<\{ `after`: `string` \| `null`; `revision`: `number`; `run`: [`CohortRun`](/api/cohort-core/src/type-aliases/cohortrun/); \}\>\>

---

### current()

> **current**(`scope`, `definitionId`): `Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\> \| `undefined`\>

#### Parameters

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

##### definitionId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\> \| `undefined`\>

---

### eraseSubject()

> **eraseSubject**(`scope`, `subjectId`): `Promise`\<`void`\>

Erasure invalidates affected publications and completed runs, then prevents source replay.

#### Parameters

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

##### subjectId

`string`

#### Returns

`Promise`\<`void`\>

---

### materializePage()

> **materializePage**(`input`, `runId`, `expectedRevision`, `pageSize`): `Promise`\<`Readonly`\<\{ `complete`: `boolean`; `members`: readonly `Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>[]; `revision`: `number`; \}\>\>

#### Parameters

##### input

[`CohortMaterialization`](/api/cohort-drizzle/src/type-aliases/cohortmaterialization/)

##### runId

`string`

##### expectedRevision

`number`

##### pageSize

`number`

#### Returns

`Promise`\<`Readonly`\<\{ `complete`: `boolean`; `members`: readonly `Readonly`\<\{ `explanation`: [`CohortExplanation`](/api/cohort-core/src/type-aliases/cohortexplanation/); `result`: [`CohortResult`](/api/cohort-core/src/type-aliases/cohortresult/); `subjectId`: `string`; \}\>[]; `revision`: `number`; \}\>\>

---

### publish()

> **publish**(`runId`, `snapshot`, `expectedRevision`, `audit`): `Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\>\>

#### Parameters

##### runId

`string`

##### snapshot

[`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/)

##### expectedRevision

`number`

##### audit

`Readonly`\<\{ `actor`: `string`; `idempotencyKey`: `string`; `reason`: `string`; \}\>

#### Returns

`Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\>\>

---

### read()

> **read**(`snapshotId`): `Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\> \| `undefined`\>

#### Parameters

##### snapshotId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\> \| `undefined`\>

#### Implementation of

[`CohortPublicationStore`](/api/cohort-core/src/interfaces/cohortpublicationstore/).[`read`](/api/cohort-core/src/interfaces/cohortpublicationstore/#read)

---

### rollback()

> **rollback**(`previousSnapshotId`, `snapshot`, `expectedRevision`, `audit`, `privacy`, `now`): `Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\>\>

#### Parameters

##### previousSnapshotId

`string`

##### snapshot

[`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/)

##### expectedRevision

`number`

##### audit

`Readonly`\<\{ `actor`: `string`; `idempotencyKey`: `string`; `reason`: `string`; \}\>

##### privacy

[`CohortPrivacyReader`](/api/cohort-core/src/interfaces/cohortprivacyreader/)

##### now

`Date`

#### Returns

`Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; `withdrawn`: `boolean`; \}\>\>

---

### saveDefinition()

> **saveDefinition**(`definition`, `registration`, `context`): `Promise`\<`void`\>

#### Parameters

##### definition

[`CohortDefinition`](/api/cohort-core/src/type-aliases/cohortdefinition/)

##### registration

[`CohortRegistration`](/api/cohort-core/src/type-aliases/cohortregistration/)

##### context

[`CohortValidationContext`](/api/cohort-core/src/type-aliases/cohortvalidationcontext/)

#### Returns

`Promise`\<`void`\>

---

### start()

> **start**(`input`, `run`): `Promise`\<`void`\>

#### Parameters

##### input

[`CohortMaterialization`](/api/cohort-drizzle/src/type-aliases/cohortmaterialization/)

##### run

[`CohortRun`](/api/cohort-core/src/type-aliases/cohortrun/)

#### Returns

`Promise`\<`void`\>

---

### stop()

> **stop**(`runId`, `scope`, `expectedRevision`, `status`): `Promise`\<`void`\>

#### Parameters

##### runId

`string`

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

##### expectedRevision

`number`

##### status

`"failed"` \| `"canceled"`

#### Returns

`Promise`\<`void`\>

---

### withdraw()

> **withdraw**(`snapshotId`, `scope`): `Promise`\<`void`\>

#### Parameters

##### snapshotId

`string`

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

#### Returns

`Promise`\<`void`\>
