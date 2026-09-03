---
editUrl: false
next: false
prev: false
title: "AudienceRegistry"
---

Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.

## Constructors

### Constructor

> **new AudienceRegistry**(): `AudienceRegistry`

#### Returns

`AudienceRegistry`

## Methods

### list()

> **list**(): readonly `Readonly`\<\{ `id`: `string`; `scope`: [`AudienceScope`](/api/engagement-core/src/type-aliases/audiencescope/); \}\>[]

#### Returns

readonly `Readonly`\<\{ `id`: `string`; `scope`: [`AudienceScope`](/api/engagement-core/src/type-aliases/audiencescope/); \}\>[]

---

### preview()

> **preview**\<`TMember`\>(`audience`, `context`, `limit`): `Promise`\<readonly `TMember`[]\>

#### Type Parameters

##### TMember

`TMember`

#### Parameters

##### audience

[`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)\<`TMember`\>

##### context

[`AudienceContext`](/api/engagement-core/src/type-aliases/audiencecontext/)

##### limit

`number`

#### Returns

`Promise`\<readonly `TMember`[]\>

---

### register()

> **register**\<`TMember`\>(`audience`, `instance`): `void`

#### Type Parameters

##### TMember

`TMember`

#### Parameters

##### audience

[`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)\<`TMember`\>

##### instance

[`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/)\<`TMember`\>

#### Returns

`void`

---

### resolve()

> **resolve**\<`TMember`\>(`audience`): [`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/)\<`TMember`\>

#### Type Parameters

##### TMember

`TMember`

#### Parameters

##### audience

[`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)\<`TMember`\>

#### Returns

[`AudienceSource`](/api/engagement-core/src/interfaces/audiencesource/)\<`TMember`\>
