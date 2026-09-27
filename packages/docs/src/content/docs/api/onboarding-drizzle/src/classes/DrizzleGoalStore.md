---
editUrl: false
next: false
prev: false
title: "DrizzleGoalStore"
---

PostgreSQL goal store. The outbox must share this store's TxManager.

## Extends

- [`GoalStore`](/api/onboarding-core/src/classes/goalstore/)

## Constructors

### Constructor

> **new DrizzleGoalStore**(`db`, `txManager`): `DrizzleGoalStore`

#### Parameters

##### db

[`DrizzleOnboardingClient`](/api/onboarding-drizzle/src/type-aliases/drizzleonboardingclient/)

##### txManager

[`TxManager`](/api/tx-core/src/classes/txmanager/)\<[`DrizzleOnboardingClient`](/api/onboarding-drizzle/src/type-aliases/drizzleonboardingclient/)\>

#### Returns

`DrizzleGoalStore`

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`constructor`](/api/onboarding-core/src/classes/goalstore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`GoalStore`](/api/onboarding-core/src/classes/goalstore/)\>

#### Inherited from

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`token`](/api/onboarding-core/src/classes/goalstore/#token)

## Methods

### beginEpisode()

> **beginEpisode**(`episode`): `Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

#### Parameters

##### episode

[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/)

#### Returns

`Promise`\<\{ `episode`: [`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/); `status`: `"created"` \| `"existing"`; \}\>

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`beginEpisode`](/api/onboarding-core/src/classes/goalstore/#beginepisode)

---

### getEpisode()

> **getEpisode**(`key`): `Promise`\<[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/) \| `null`\>

#### Parameters

##### key

[`GoalEpisodeKey`](/api/onboarding-core/src/type-aliases/goalepisodekey/)

#### Returns

`Promise`\<[`GoalEpisode`](/api/onboarding-core/src/type-aliases/goalepisode/) \| `null`\>

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`getEpisode`](/api/onboarding-core/src/classes/goalstore/#getepisode)

---

### getPublishedDefinition()

> **getPublishedDefinition**(`scope`, `definitionId`, `version?`): `Promise`\<[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/) \| `null`\>

#### Parameters

##### scope

[`GoalScope`](/api/onboarding-core/src/type-aliases/goalscope/)

##### definitionId

`string`

##### version?

`string`

#### Returns

`Promise`\<[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/) \| `null`\>

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`getPublishedDefinition`](/api/onboarding-core/src/classes/goalstore/#getpublisheddefinition)

---

### observeAction()

> **observeAction**(`input`): `Promise`\<[`GoalObservationResult`](/api/onboarding-core/src/type-aliases/goalobservationresult/)\>

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

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`observeAction`](/api/onboarding-core/src/classes/goalstore/#observeaction)

---

### publishDefinition()

> **publishDefinition**(`publication`): `Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>

#### Parameters

##### publication

[`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/)

#### Returns

`Promise`\<\{ `publication`: [`GoalDefinitionPublication`](/api/onboarding-core/src/type-aliases/goaldefinitionpublication/); `status`: `"published"` \| `"duplicate"`; \}\>

#### Overrides

[`GoalStore`](/api/onboarding-core/src/classes/goalstore/).[`publishDefinition`](/api/onboarding-core/src/classes/goalstore/#publishdefinition)
