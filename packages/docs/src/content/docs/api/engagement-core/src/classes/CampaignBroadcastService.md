---
editUrl: false
next: false
prev: false
title: "CampaignBroadcastService"
---

## Constructors

### Constructor

> **new CampaignBroadcastService**(`campaigns`, `store`, `executions`, `sender`, `publisher?`, `clock?`): `CampaignBroadcastService`

#### Parameters

##### campaigns

[`CampaignRegistry`](/api/engagement-core/src/classes/campaignregistry/)

##### store

[`CampaignStore`](/api/engagement-core/src/interfaces/campaignstore/)

##### executions

[`ExecutionManager`](/api/execution-core/src/interfaces/executionmanager/)

##### sender

[`CampaignMessageSender`](/api/engagement-core/src/interfaces/campaignmessagesender/)

##### publisher?

[`CampaignExecutionPublisher`](/api/engagement-core/src/interfaces/campaignexecutionpublisher/)

##### clock?

() => `Date`

#### Returns

`CampaignBroadcastService`

## Methods

### broadcast()

> **broadcast**\<`TCampaign`\>(`campaign`, `scope`, `snapshotId`, `options?`): `Promise`\<`Readonly`\<\{ `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `progress`: [`CampaignProgress`](/api/engagement-core/src/type-aliases/campaignprogress/); `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

#### Type Parameters

##### TCampaign

`TCampaign` _extends_ `Readonly`\<\{ `audience`: (...`arguments_`) => `object`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/); `id`: `string`; `map`: (`member`) => `unknown`; `message`: [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/); `version`: `string`; \}\>

#### Parameters

##### campaign

`TCampaign`

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

##### options?

[`CampaignExecutionOptions`](/api/engagement-core/src/type-aliases/campaignexecutionoptions/) = `{}`

#### Returns

`Promise`\<`Readonly`\<\{ `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `progress`: [`CampaignProgress`](/api/engagement-core/src/type-aliases/campaignprogress/); `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

---

### cancel()

> **cancel**(`executionId`, `reason?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Parameters

##### executionId

`string`

##### reason?

`string`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### createExecution()

> **createExecution**\<`TCampaign`\>(`campaign`, `scope`, `snapshotId`, `options?`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Type Parameters

##### TCampaign

`TCampaign` _extends_ `Readonly`\<\{ `audience`: (...`arguments_`) => `object`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/); `id`: `string`; `map`: (`member`) => `unknown`; `message`: [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/); `version`: `string`; \}\>

#### Parameters

##### campaign

`TCampaign`

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

##### options?

`Readonly`\<\{ `concurrency?`: `number`; `maxAttempts?`: `number`; `pageSize?`: `number`; \}\> & `Readonly`\<\{ `scheduledFor?`: `Date`; \}\> = `{}`

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

---

### execute()

> **execute**(`executionId`): `Promise`\<`Readonly`\<\{ `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `progress`: [`CampaignProgress`](/api/engagement-core/src/type-aliases/campaignprogress/); `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

#### Parameters

##### executionId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `execution`: [`Execution`](/api/execution-core/src/interfaces/execution/); `progress`: [`CampaignProgress`](/api/engagement-core/src/type-aliases/campaignprogress/); `snapshot`: [`CampaignSnapshot`](/api/engagement-core/src/type-aliases/campaignsnapshot/); \}\>\>

---

### schedule()

> **schedule**\<`TCampaign`\>(`campaign`, `scope`, `snapshotId`, `options`): `Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>

#### Type Parameters

##### TCampaign

`TCampaign` _extends_ `Readonly`\<\{ `audience`: (...`arguments_`) => `object`; `descriptor`: [`CampaignDescriptor`](/api/engagement-core/src/type-aliases/campaigndescriptor/); `id`: `string`; `map`: (`member`) => `unknown`; `message`: [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/); `version`: `string`; \}\>

#### Parameters

##### campaign

`TCampaign`

##### scope

[`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/)

##### snapshotId

`string`

##### options

[`CampaignScheduleOptions`](/api/engagement-core/src/type-aliases/campaignscheduleoptions/)

#### Returns

`Promise`\<[`Execution`](/api/execution-core/src/interfaces/execution/)\>
