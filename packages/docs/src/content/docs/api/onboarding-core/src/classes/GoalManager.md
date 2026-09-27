---
editUrl: false
next: false
prev: false
title: "GoalManager"
---

## Constructors

### Constructor

> **new GoalManager**(`store`, `verifier`, `publicationAuthorizer`, `subjectVerifier`): `GoalManager`

#### Parameters

##### store

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/)

##### verifier

[`GoalReceiptVerifier`](/api/onboarding-core/src/interfaces/goalreceiptverifier/)

##### publicationAuthorizer

[`GoalPublicationAuthorizer`](/api/onboarding-core/src/interfaces/goalpublicationauthorizer/)

##### subjectVerifier

[`GoalSubjectVerifier`](/api/onboarding-core/src/interfaces/goalsubjectverifier/)

#### Returns

`GoalManager`

## Methods

### beginEpisode()

> **beginEpisode**(`input`): `Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

#### Parameters

##### input

###### anchor

[`GoalAnchor`](/api/onboarding-core/src/type-aliases/goalanchor/)

###### definitionId

`string`

###### id

`string`

###### scope

[`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

###### startedAt

`Date`

###### subject

[`GoalSubject`](/api/onboarding-core/src/type-aliases/goalsubject/)

#### Returns

`Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

---

### getProgress()

> **getProgress**(`input`): `Promise`\<[`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/)\>

#### Parameters

##### input

[`GoalEpisodeKey`](/api/onboarding-core/src/type-aliases/goalepisodekey/) & `object`

#### Returns

`Promise`\<[`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/)\>

---

### observeAction()

> **observeAction**(`input`): `Promise`\<[`GoalObservationResult`](/api/onboarding-core/src/type-aliases/goalobservationresult/)\>

#### Parameters

##### input

###### episodeId

`string`

###### receipt

[`GoalEvidence`](/api/onboarding-core/src/type-aliases/goalevidence/)

###### receivedAt

`Date`

###### scope

[`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

###### subject

[`GoalSubject`](/api/onboarding-core/src/type-aliases/goalsubject/)

#### Returns

`Promise`\<[`GoalObservationResult`](/api/onboarding-core/src/type-aliases/goalobservationresult/)\>

---

### publishDefinition()

> **publishDefinition**(`publication`): `Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>

#### Parameters

##### publication

[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/)

#### Returns

`Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>
