---
editUrl: false
next: false
prev: false
title: "ContactPolicyOperations"
---

Resolve access from the server's authenticated context; never accept client-granted permissions.

## Constructors

### Constructor

> **new ContactPolicyOperations**(`options`): `ContactPolicyOperations`

#### Parameters

##### options

`Readonly`\<\{ `registration`: [`ContactPolicyAdminRegistration`](/api/admin-core/src/type-aliases/contactpolicyadminregistration/); `store`: [`ContactPolicyAdminStore`](/api/admin-core/src/interfaces/contactpolicyadminstore/); `authorize`: `Promise`\<`Readonly`\<\{ `actorId`: `string`; `permissions`: readonly (`"contact-policy.read"` \| `"contact-policy.write"`)[]; \}\>\>; `createPolicy`: [`ContactPolicy`](/api/engagement-core/src/classes/contactpolicy/); \}\>

#### Returns

`ContactPolicyOperations`

## Methods

### dryRun()

> **dryRun**(`target`, `request`): `Promise`\<`Readonly`\<\{ `allowed`: `boolean`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `nextEligibleAt?`: `Date`; `reason`: `"released"` \| `"unknown"` \| `"allowed"` \| `"limit"` \| `"spacing"` \| `"quiet-hours"`; \}\>\>

#### Parameters

##### target

[`ContactPolicyAdminScope`](/api/admin-core/src/type-aliases/contactpolicyadminscope/)

##### request

[`ContactPolicyRequest`](/api/engagement-core/src/type-aliases/contactpolicyrequest/)

#### Returns

`Promise`\<`Readonly`\<\{ `allowed`: `boolean`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `nextEligibleAt?`: `Date`; `reason`: `"released"` \| `"unknown"` \| `"allowed"` \| `"limit"` \| `"spacing"` \| `"quiet-hours"`; \}\>\>

---

### load()

> **load**(`target`): `Promise`\<`Readonly`\<\{ `historyComplete`: `boolean`; `policy`: [`ContactPolicyAdminSnapshot`](/api/admin-core/src/type-aliases/contactpolicyadminsnapshot/); `recentSuppressions`: readonly `Readonly`\<\{ `campaignId?`: `string`; `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `logicalSendId`: `string`; `occurredAt`: `Date`; \}\>[]; \}\> \| `undefined`\>

#### Parameters

##### target

[`ContactPolicyAdminScope`](/api/admin-core/src/type-aliases/contactpolicyadminscope/)

#### Returns

`Promise`\<`Readonly`\<\{ `historyComplete`: `boolean`; `policy`: [`ContactPolicyAdminSnapshot`](/api/admin-core/src/type-aliases/contactpolicyadminsnapshot/); `recentSuppressions`: readonly `Readonly`\<\{ `campaignId?`: `string`; `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `logicalSendId`: `string`; `occurredAt`: `Date`; \}\>[]; \}\> \| `undefined`\>

---

### save()

> **save**(`target`, `edit`): `Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>

#### Parameters

##### target

[`ContactPolicyAdminScope`](/api/admin-core/src/type-aliases/contactpolicyadminscope/)

##### edit

[`ContactPolicyAdminEdit`](/api/admin-core/src/type-aliases/contactpolicyadminedit/)

#### Returns

`Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>
