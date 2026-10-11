---
editUrl: false
next: false
prev: false
title: "CohortAudienceSource"
---

## Implements

- [`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/)\<[`CohortAudienceMember`](/api/cohort-core/src/type-aliases/cohortaudiencemember/)\>

## Constructors

### Constructor

> **new CohortAudienceSource**(`reader`, `snapshotId`, `scope`, `subjectKind`, `now`): `CohortAudienceSource`

#### Parameters

##### reader

[`PublishedCohortReader`](/api/cohort-core/src/classes/publishedcohortreader/)

##### snapshotId

`string`

##### scope

[`CohortScope`](/api/cohort-core/src/type-aliases/cohortscope/)

##### subjectKind

`string`

##### now

() => `Date`

#### Returns

`CohortAudienceSource`

## Methods

### estimate()

> **estimate**(`context`): `Promise`\<`number`\>

#### Parameters

##### context

[`AudienceContext`](/api/engagement-core/src/type-aliases/audiencecontext/)

#### Returns

`Promise`\<`number`\>

#### Implementation of

[`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/).[`estimate`](/api/engagement-core/src/interfaces/audiencesource/#estimate)

---

### members()

> **members**(`context`): `AsyncIterable`\<`Readonly`\<\{ `cohortSnapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectId`: `string`; \}\>\>

#### Parameters

##### context

[`AudienceContext`](/api/engagement-core/src/type-aliases/audiencecontext/)

#### Returns

`AsyncIterable`\<`Readonly`\<\{ `cohortSnapshot`: [`CohortSnapshot`](/api/cohort-core/src/type-aliases/cohortsnapshot/); `subjectId`: `string`; \}\>\>

#### Implementation of

[`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/).[`members`](/api/engagement-core/src/interfaces/audiencesource/#members)
