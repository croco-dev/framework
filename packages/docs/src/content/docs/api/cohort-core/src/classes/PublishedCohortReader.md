---
editUrl: false
next: false
prev: false
title: "PublishedCohortReader"
---

The store is an application-supplied trusted publication boundary, never a client payload.

## Constructors

### Constructor

> **new PublishedCohortReader**(`store`, `privacy`): `PublishedCohortReader`

#### Parameters

##### store

[`CohortPublicationStore`](/api/cohort-core/src/interfaces/cohortpublicationstore/)

##### privacy

[`CohortPrivacyReader`](/api/cohort-core/src/interfaces/cohortprivacyreader/)

#### Returns

`PublishedCohortReader`

## Methods

### read()

> **read**(`snapshotId`, `scope`, `subjectKind`, `now`): `Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; \}\>\>

#### Parameters

##### snapshotId

`string`

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

##### subjectKind

`string`

##### now

`Date`

#### Returns

`Promise`\<`Readonly`\<\{ `snapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectIds`: readonly `string`[]; \}\>\>
