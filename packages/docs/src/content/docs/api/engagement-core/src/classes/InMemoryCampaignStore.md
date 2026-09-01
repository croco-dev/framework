---
editUrl: false
next: false
prev: false
title: "InMemoryCampaignStore"
---

## Implements

- [`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/)

## Constructors

### Constructor

> **new InMemoryCampaignStore**(): `InMemoryCampaignStore`

#### Returns

`InMemoryCampaignStore`

## Methods

### appendSnapshotMembers()

> **appendSnapshotMembers**(`input`): `Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Parameters

##### input

[`AppendCampaignSnapshotMembersInput`](/api/engagement-core/src/type-aliases/appendcampaignsnapshotmembersinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`appendSnapshotMembers`](/api/engagement-core/src/interfaces/campaignstore/#appendsnapshotmembers)

---

### completeSnapshot()

> **completeSnapshot**(`input`): `Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Parameters

##### input

[`CompleteCampaignSnapshotInput`](/api/engagement-core/src/type-aliases/completecampaignsnapshotinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`completeSnapshot`](/api/engagement-core/src/interfaces/campaignstore/#completesnapshot)

---

### createSnapshot()

> **createSnapshot**(`input`): `Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Parameters

##### input

[`CreateCampaignSnapshotInput`](/api/engagement-core/src/type-aliases/createcampaignsnapshotinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`createSnapshot`](/api/engagement-core/src/interfaces/campaignstore/#createsnapshot)

---

### failSnapshot()

> **failSnapshot**(`input`): `Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Parameters

##### input

[`FailCampaignSnapshotInput`](/api/engagement-core/src/type-aliases/failcampaignsnapshotinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`failSnapshot`](/api/engagement-core/src/interfaces/campaignstore/#failsnapshot)

---

### getMemberOutcome()

> **getMemberOutcome**(`scope`, `snapshotId`, `memberKey`): `Promise`\<[`CampaignMemberOutcome`](/api/engagement-core/src/type-aliases/campaignmemberoutcome/) \| `undefined`\>

#### Parameters

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

##### memberKey

`string`

#### Returns

`Promise`\<[`CampaignMemberOutcome`](/api/engagement-core/src/type-aliases/campaignmemberoutcome/) \| `undefined`\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`getMemberOutcome`](/api/engagement-core/src/interfaces/campaignstore/#getmemberoutcome)

---

### getSnapshot()

> **getSnapshot**(`scope`, `snapshotId`): `Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\> \| `undefined`\>

#### Parameters

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `audienceId`: `string`; `campaignId`: `string`; `campaignVersion`: `string`; `completedAt?`: `Date`; `createdAt`: `Date`; `descriptorFingerprint`: `string`; `failureCode?`: `string`; `id`: `string`; `memberCount`: `number`; `messageId`: `string`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `state`: [`CampaignSnapshotState`](/api/engagement-core/src/type-aliases/campaignsnapshotstate/); \}\> \| `undefined`\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`getSnapshot`](/api/engagement-core/src/interfaces/campaignstore/#getsnapshot)

---

### listSnapshotMembers()

> **listSnapshotMembers**(`scope`, `snapshotId`, `options`): `Promise`\<`Readonly`\<\{ `members`: readonly [`CampaignSnapshotMember`](/api/engagement-core/src/type-aliases/campaignsnapshotmember/)[]; `nextOrdinal?`: `number`; \}\>\>

#### Parameters

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

##### options

[`ListCampaignSnapshotMembersOptions`](/api/engagement-core/src/type-aliases/listcampaignsnapshotmembersoptions/)

#### Returns

`Promise`\<`Readonly`\<\{ `members`: readonly [`CampaignSnapshotMember`](/api/engagement-core/src/type-aliases/campaignsnapshotmember/)[]; `nextOrdinal?`: `number`; \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`listSnapshotMembers`](/api/engagement-core/src/interfaces/campaignstore/#listsnapshotmembers)

---

### recordMemberOutcome()

> **recordMemberOutcome**(`input`): `Promise`\<[`CampaignMemberOutcome`](/api/engagement-core/src/type-aliases/campaignmemberoutcome/)\>

#### Parameters

##### input

[`CampaignMemberOutcome`](/api/engagement-core/src/type-aliases/campaignmemberoutcome/)

#### Returns

`Promise`\<[`CampaignMemberOutcome`](/api/engagement-core/src/type-aliases/campaignmemberoutcome/)\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`recordMemberOutcome`](/api/engagement-core/src/interfaces/campaignstore/#recordmemberoutcome)

---

### summarizeSnapshot()

> **summarizeSnapshot**(`scope`, `snapshotId`): `Promise`\<`Readonly`\<\{ `completed`: `number`; `failed`: `number`; `pending`: `number`; `queued`: `number`; `skipped`: `number`; `suppressed`: `number`; `total`: `number`; \}\>\>

#### Parameters

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `completed`: `number`; `failed`: `number`; `pending`: `number`; `queued`: `number`; `skipped`: `number`; `suppressed`: `number`; `total`: `number`; \}\>\>

#### Implementation of

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/).[`summarizeSnapshot`](/api/engagement-core/src/interfaces/campaignstore/#summarizesnapshot)
