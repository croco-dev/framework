---
editUrl: false
next: false
prev: false
title: "ContactPolicyTransaction"
---

## Properties

### reservations

> `readonly` **reservations**: readonly `Readonly`\<\{ `campaignId?`: `string`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `createdAt`: `Date`; `executionIds`: readonly `string`[]; `exempt`: `boolean`; `expiresAt`: `Date`; `logicalSendId`: `string`; `messageId`: `string`; `payloadFingerprint`: `string`; `policyVersion`: `string`; `recipient`: `string`; `reconciliation?`: [`ContactPolicyReconciliation`](/api/engagement-core/src/type-aliases/contactpolicyreconciliation/); `scope`: [`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/); `state`: `"released"` \| `"unknown"` \| `"reserved"` \| `"committed"`; `subject`: `string`; `topic`: `string`; `windowKey`: `string`; \}\>[]

## Methods

### save()

> **save**(`reservation`): `void`

#### Parameters

##### reservation

[`ContactPolicyReservation`](/api/engagement-core/src/type-aliases/contactpolicyreservation/)

#### Returns

`void`
