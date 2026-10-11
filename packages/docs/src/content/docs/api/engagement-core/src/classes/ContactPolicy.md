---
editUrl: false
next: false
prev: false
title: "ContactPolicy"
---

## Constructors

### Constructor

> **new ContactPolicy**(`options`): `ContactPolicy`

#### Parameters

##### options

[`ContactPolicyOptions`](/api/engagement-core/src/type-aliases/contactpolicyoptions/)

#### Returns

`ContactPolicy`

## Methods

### commit()

> **commit**(`ref`, `executionIds?`): `Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

#### Parameters

##### ref

[`ContactPolicyReservationRef`](/api/engagement-core/src/type-aliases/contactpolicyreservationref/)

##### executionIds?

readonly `string`[] = `[]`

#### Returns

`Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

---

### evaluate()

> **evaluate**(`request`): `Promise`\<`Readonly`\<\{ `allowed`: `boolean`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `nextEligibleAt?`: `Date`; `reason`: `"allowed"` \| `"limit"` \| `"spacing"` \| `"quiet-hours"` \| `"released"` \| `"unknown"`; \}\>\>

#### Parameters

##### request

[`ContactPolicyRequest`](/api/engagement-core/src/type-aliases/contactpolicyrequest/)

#### Returns

`Promise`\<`Readonly`\<\{ `allowed`: `boolean`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `nextEligibleAt?`: `Date`; `reason`: `"allowed"` \| `"limit"` \| `"spacing"` \| `"quiet-hours"` \| `"released"` \| `"unknown"`; \}\>\>

---

### markUnknown()

> **markUnknown**(`ref`): `Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

#### Parameters

##### ref

[`ContactPolicyReservationRef`](/api/engagement-core/src/type-aliases/contactpolicyreservationref/)

#### Returns

`Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

---

### reconcile()

> **reconcile**(`ref`, `resolution`): `Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

The caller verifies provider evidence; ordinary expiry and retries never reconcile acceptance.

#### Parameters

##### ref

[`ContactPolicyReservationRef`](/api/engagement-core/src/type-aliases/contactpolicyreservationref/)

##### resolution

[`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/)

#### Returns

`Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

---

### release()

> **release**(`ref`): `Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

Only a reservation for which dispatch never started may be released.

#### Parameters

##### ref

[`ContactPolicyReservationRef`](/api/engagement-core/src/type-aliases/contactpolicyreservationref/)

#### Returns

`Promise`\<`Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>\>

---

### reserve()

> **reserve**(`request`): `Promise`\<`Readonly`\<\{ `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `replay`: `boolean`; `reservation?`: `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>; \}\>\>

#### Parameters

##### request

[`ContactPolicyRequest`](/api/engagement-core/src/type-aliases/contactpolicyrequest/)

#### Returns

`Promise`\<`Readonly`\<\{ `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `replay`: `boolean`; `reservation?`: `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>; \}\>\>

---

### reserveBatch()

> **reserveBatch**(`requests`): `Promise`\<readonly `Readonly`\<\{ `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `replay`: `boolean`; `reservation?`: `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>; \}\>[]\>

Priority applies only to this submitted batch. Ties use logicalSendId in code-unit order.

#### Parameters

##### requests

readonly `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `endpointGroupId?`: `string`; `logicalSendId`: `string`; `messageId`: `string`; `now`: `Date`; `payloadFingerprint`: `string`; `recipient`: `string`; `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `topic`: `string`; \}\>[]

#### Returns

`Promise`\<readonly `Readonly`\<\{ `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `replay`: `boolean`; `reservation?`: `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>; \}\>[]\>
