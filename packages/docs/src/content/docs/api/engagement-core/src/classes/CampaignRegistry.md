---
editUrl: false
next: false
prev: false
title: "CampaignRegistry"
---

Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.

## Constructors

### Constructor

> **new CampaignRegistry**(): `CampaignRegistry`

#### Returns

`CampaignRegistry`

## Methods

### list()

> **list**(): readonly `Readonly`\<\{ `audienceId`: `string`; `audienceScope`: [`AudienceScope`](/api/engagement-core/src/type-aliases/audiencescope/); `hash`: `` `sha256:${string}` ``; `id`: `string`; `messageId`: `string`; `version`: `string`; \}\>[]

#### Returns

readonly `Readonly`\<\{ `audienceId`: `string`; `audienceScope`: [`AudienceScope`](/api/engagement-core/src/type-aliases/audiencescope/); `hash`: `` `sha256:${string}` ``; `id`: `string`; `messageId`: `string`; `version`: `string`; \}\>[]

---

### register()

> **register**\<`TCampaign`\>(`campaign`): `void`

#### Type Parameters

##### TCampaign

`TCampaign` _extends_ `Readonly`\<\{ `audience`: (...`arguments_`) => `object`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/); `id`: `string`; `map`: (`member`) => `unknown`; `message`: [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/); `version`: `string`; \}\>

#### Parameters

##### campaign

`TCampaign`

#### Returns

`void`

---

### resolve()

> **resolve**\<`TCampaign`\>(`campaignId`): `TCampaign`

#### Type Parameters

##### TCampaign

`TCampaign` _extends_ `Readonly`\<\{ `audience`: (...`arguments_`) => `object`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/); `id`: `string`; `map`: (`member`) => `unknown`; `message`: [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/); `version`: `string`; \}\>

#### Parameters

##### campaignId

`TCampaign`\[`"id"`\]

#### Returns

`TCampaign`
