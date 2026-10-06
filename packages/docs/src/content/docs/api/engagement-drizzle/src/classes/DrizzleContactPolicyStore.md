---
editUrl: false
next: false
prev: false
title: "DrizzleContactPolicyStore"
---

Serializes budget evaluation and ledger updates across PostgreSQL connections.

## Implements

- [`ContactPolicyStore`](/api/engagement-core/src/interfaces/contactpolicystore/)

## Constructors

### Constructor

> **new DrizzleContactPolicyStore**(`db`): `DrizzleContactPolicyStore`

#### Parameters

##### db

[`DrizzleContactPolicyClient`](/api/engagement-drizzle/src/type-aliases/drizzlecontactpolicyclient/)

#### Returns

`DrizzleContactPolicyStore`

## Methods

### read()

> **read**(`scope`, `subject`): `Promise`\<readonly `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"unknown"` \| `"released"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>[]\>

#### Parameters

##### scope

[`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/)

##### subject

`string`

#### Returns

`Promise`\<readonly `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"unknown"` \| `"released"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>[]\>

#### Implementation of

[`ContactPolicyStore`](/api/engagement-core/src/interfaces/contactpolicystore/).[`read`](/api/engagement-core/src/interfaces/contactpolicystore/#read)

---

### transact()

> **transact**\<`T`\>(`scope`, `subject`, `operation`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### scope

[`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/)

##### subject

`string`

##### operation

(`transaction`) => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

#### Implementation of

[`ContactPolicyStore`](/api/engagement-core/src/interfaces/contactpolicystore/).[`transact`](/api/engagement-core/src/interfaces/contactpolicystore/#transact)
