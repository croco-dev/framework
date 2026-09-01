---
editUrl: false
next: false
prev: false
title: "CampaignSnapshotService"
---

## Constructors

### Constructor

> **new CampaignSnapshotService**(`audiences`, `store`, `clock?`, `idGenerator?`): `CampaignSnapshotService`

#### Parameters

##### audiences

[`AudienceRegistry`](/api/engagement-core/src/classes/audienceregistry/)

##### store

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/)

##### clock?

() => `Date`

##### idGenerator?

() => `string`

#### Returns

`CampaignSnapshotService`

## Methods

### createSnapshot()

> **createSnapshot**\<`TId`, `TVersion`, `TAudience`, `TMessage`\>(`campaign`, `context`, `options?`): `Promise`\<`Readonly`\<\{ `estimatedMemberCount?`: `number`; `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

#### Type Parameters

##### TId

`TId` _extends_ `string`

##### TVersion

`TVersion` _extends_ `string`

##### TAudience

`TAudience` _extends_ [`AudienceConstructor`](/api/engagement-core/src/type-aliases/audienceconstructor/)

##### TMessage

`TMessage` _extends_ `Readonly`\<\{ `channels`: readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]; `data`: `ZodTypeAny`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<readonly (`"email"` \| `"push"` \| `"sms"` \| `"inApp"`)[]\>; `id`: `string`; `topic`: `string`; \}\>

#### Parameters

##### campaign

[`DefinedCampaign`](/api/engagement-core/src/type-aliases/definedcampaign/)\<`TId`, `TVersion`, `TAudience`, `TMessage`\>

##### context

[`AudienceContext`](/api/engagement-core/src/type-aliases/audiencecontext/)

##### options?

[`CampaignSnapshotOptions`](/api/engagement-core/src/type-aliases/campaignsnapshotoptions/) = `{}`

#### Returns

`Promise`\<`Readonly`\<\{ `estimatedMemberCount?`: `number`; `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

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
