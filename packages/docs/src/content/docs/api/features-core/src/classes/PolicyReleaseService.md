---
editUrl: false
next: false
prev: false
title: "PolicyReleaseService"
---

## Constructors

### Constructor

> **new PolicyReleaseService**(`options?`): `PolicyReleaseService`

#### Parameters

##### options?

[`PolicyReleaseServiceOptions`](/api/features-core/src/type-aliases/policyreleaseserviceoptions/) = `{}`

#### Returns

`PolicyReleaseService`

## Methods

### cancelSchedule()

> **cancelSchedule**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PolicyTransitionCommand`](/api/features-core/src/type-aliases/policytransitioncommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### createDraft()

> **createDraft**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`CreatePolicyDraftCommand`](/api/features-core/src/type-aliases/createpolicydraftcommand/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### evaluate()

> **evaluate**\<`TContext`, `TResult`\>(`input`): `Promise`\<[`PolicyEvaluationResult`](/api/features-core/src/type-aliases/policyevaluationresult/)\<`TResult`\>\>

#### Type Parameters

##### TContext

`TContext` _extends_ `Readonly`\<`Record`\<`string`, `unknown`\>\>

##### TResult

`TResult` = `unknown`

#### Parameters

##### input

[`EvaluatePolicyInput`](/api/features-core/src/type-aliases/evaluatepolicyinput/)\<`TContext`\>

#### Returns

`Promise`\<[`PolicyEvaluationResult`](/api/features-core/src/type-aliases/policyevaluationresult/)\<`TResult`\>\>

---

### getCommandReceipt()

> **getCommandReceipt**(`policyId`, `scope`, `idempotencyKey`): `Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/) \| `null`\>

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### idempotencyKey

`string`

#### Returns

`Promise`\<[`PolicyCommandReceipt`](/api/features-core/src/type-aliases/policycommandreceipt/) \| `null`\>

---

### getLatestRevision()

> **getLatestRevision**\<`TValue`\>(`policyId`, `scope`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

---

### getRegistration()

> **getRegistration**\<`TValue`\>(`policyId`, `schemaVersion?`): [`PolicyDefinition`](/api/features-core/src/type-aliases/policydefinition/)\<`TValue`\> \| `null`

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### policyId

`string`

##### schemaVersion?

`string`

#### Returns

[`PolicyDefinition`](/api/features-core/src/type-aliases/policydefinition/)\<`TValue`\> \| `null`

---

### getRevision()

> **getRevision**\<`TValue`\>(`policyId`, `scope`, `revision`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

##### revision

`string` \| `number`

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\> \| `null`\>

---

### listRevisions()

> **listRevisions**\<`TValue`\>(`policyId`, `scope`): `Promise`\<readonly [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>[]\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### policyId

`string`

##### scope

[`PolicyScope`](/api/features-core/src/type-aliases/policyscope/)

#### Returns

`Promise`\<readonly [`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>[]\>

---

### pause()

> **pause**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PausePolicyCommand`](/api/features-core/src/type-aliases/pausepolicycommand/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### publish()

> **publish**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PublishPolicyCommand`](/api/features-core/src/type-aliases/publishpolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### publishNow()

> **publishNow**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PublishPolicyCommand`](/api/features-core/src/type-aliases/publishpolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### registerPolicy()

> **registerPolicy**\<`TValue`, `TContext`, `TResult`\>(`policy`): [`PolicyDefinition`](/api/features-core/src/type-aliases/policydefinition/)\<`TValue`\>

#### Type Parameters

##### TValue

`TValue`

##### TContext

`TContext` _extends_ `Readonly`\<`Record`\<`string`, `unknown`\>\> = `Readonly`\<`Record`\<`string`, `unknown`\>\>

##### TResult

`TResult` = `unknown`

#### Parameters

##### policy

[`ParameterizedPolicy`](/api/features-core/src/type-aliases/parameterizedpolicy/)\<`TValue`, `TContext`, `TResult`\>

#### Returns

[`PolicyDefinition`](/api/features-core/src/type-aliases/policydefinition/)\<`TValue`\>

---

### resolve()

> **resolve**\<`TValue`\>(`input`): `Promise`\<[`PolicyResolution`](/api/features-core/src/type-aliases/policyresolution/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### input

[`ResolvePolicyInput`](/api/features-core/src/type-aliases/resolvepolicyinput/)

#### Returns

`Promise`\<[`PolicyResolution`](/api/features-core/src/type-aliases/policyresolution/)\<`TValue`\>\>

---

### review()

> **review**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PolicyTransitionCommand`](/api/features-core/src/type-aliases/policytransitioncommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### rollback()

> **rollback**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`RollbackPolicyCommand`](/api/features-core/src/type-aliases/rollbackpolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### schedule()

> **schedule**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`SchedulePolicyCommand`](/api/features-core/src/type-aliases/schedulepolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### schedulePublish()

> **schedulePublish**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`SchedulePolicyCommand`](/api/features-core/src/type-aliases/schedulepolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### submitReview()

> **submitReview**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`PolicyTransitionCommand`](/api/features-core/src/type-aliases/policytransitioncommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### triggerScheduled()

> **triggerScheduled**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`TriggerScheduledPolicyCommand`](/api/features-core/src/type-aliases/triggerscheduledpolicycommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### updateDraft()

> **updateDraft**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`UpdatePolicyDraftCommand`](/api/features-core/src/type-aliases/updatepolicydraftcommand/)\<`TValue`\>

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

---

### updateDraftField()

> **updateDraftField**\<`TValue`\>(`command`): `Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>

#### Type Parameters

##### TValue

`TValue`

#### Parameters

##### command

[`UpdatePolicyDraftFieldCommand`](/api/features-core/src/type-aliases/updatepolicydraftfieldcommand/)

#### Returns

`Promise`\<[`PolicyRevision`](/api/features-core/src/type-aliases/policyrevision/)\<`TValue`\>\>
