---
editUrl: false
next: false
prev: false
title: "ContactPolicyAdminStore"
---

Settings and write keys are scoped by app/environment/tenant; subject only selects authorized history.
Implementations atomically compare revision, persist policy and audit, and reject changed key reuse.

## Methods

### load()

> **load**(`target`): `Promise`\<`Readonly`\<\{ `historyComplete`: `boolean`; `policy`: [`ContactPolicyAdminSnapshot`](/api/admin-core/src/type-aliases/contactpolicyadminsnapshot/); `recentSuppressions`: readonly `Readonly`\<\{ `campaignId?`: `string`; `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `logicalSendId`: `string`; `occurredAt`: `Date`; \}\>[]; \}\> \| `undefined`\>

#### Parameters

##### target

[`ContactPolicyAdminScope`](/api/admin-core/src/type-aliases/contactpolicyadminscope/)

#### Returns

`Promise`\<`Readonly`\<\{ `historyComplete`: `boolean`; `policy`: [`ContactPolicyAdminSnapshot`](/api/admin-core/src/type-aliases/contactpolicyadminsnapshot/); `recentSuppressions`: readonly `Readonly`\<\{ `campaignId?`: `string`; `decision`: [`ContactPolicyDecision`](/api/engagement-core/src/type-aliases/contactpolicydecision/); `logicalSendId`: `string`; `occurredAt`: `Date`; \}\>[]; \}\> \| `undefined`\>

---

### save()

> **save**(`input`): `Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>

#### Parameters

##### input

[`ContactPolicyAdminSave`](/api/admin-core/src/type-aliases/contactpolicyadminsave/)

#### Returns

`Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>
