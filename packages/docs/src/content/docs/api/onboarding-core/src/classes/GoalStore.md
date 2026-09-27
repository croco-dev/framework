---
editUrl: false
next: false
prev: false
title: "GoalStore"
---

## Extended by

- [`InMemoryGoalStore`](/api/onboarding-core/src/classes/inmemorygoalstore/)
- [`DrizzleGoalStore`](/api/onboarding-drizzle/src/classes/drizzlegoalstore/)

## Constructors

### Constructor

> **new GoalStore**(): `GoalStore`

#### Returns

`GoalStore`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`GoalStore`\>

## Methods

### beginEpisode()

> `abstract` **beginEpisode**(`episode`): `Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

#### Parameters

##### episode

[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/)

#### Returns

`Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

---

### getEpisode()

> `abstract` **getEpisode**(`key`): `Promise`\<[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/) \| `null`\>

#### Parameters

##### key

[`GoalEpisodeKey`](/api/onboarding-core/src/type-aliases/goalepisodekey/)

#### Returns

`Promise`\<[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/) \| `null`\>

---

### getPublishedDefinition()

> `abstract` **getPublishedDefinition**(`scope`, `definitionId`, `version?`): `Promise`\<[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/) \| `null`\>

#### Parameters

##### scope

[`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

##### definitionId

`string`

##### version?

`string`

#### Returns

`Promise`\<[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/) \| `null`\>

---

### observeAction()

> `abstract` **observeAction**(`input`): `Promise`\<[`GoalObservationResult`](/api/onboarding-core/src/type-aliases/goalobservationresult/)\>

#### Parameters

##### input

###### key

[`GoalEpisodeKey`](/api/onboarding-core/src/type-aliases/goalepisodekey/)

###### receipt

[`GoalEvidence`](/api/onboarding-core/src/type-aliases/goalevidence/)

###### receivedAt

`Date`

#### Returns

`Promise`\<[`GoalObservationResult`](/api/onboarding-core/src/type-aliases/goalobservationresult/)\>

---

### publishDefinition()

> `abstract` **publishDefinition**(`publication`): `Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>

#### Parameters

##### publication

[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/)

#### Returns

`Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>
