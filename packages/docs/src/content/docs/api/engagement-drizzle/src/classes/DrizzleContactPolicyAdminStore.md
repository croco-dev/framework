---
editUrl: false
next: false
prev: false
title: "DrizzleContactPolicyAdminStore"
---

Durable settings and edit audit, structurally compatible with the administrative contract.

## Constructors

### Constructor

> **new DrizzleContactPolicyAdminStore**(`db`): `DrizzleContactPolicyAdminStore`

#### Parameters

##### db

[`DrizzleContactPolicyAdminClient`](/api/engagement-drizzle/src/type-aliases/drizzlecontactpolicyadminclient/)

#### Returns

`DrizzleContactPolicyAdminStore`

## Methods

### load()

> **load**(`target`): `Promise`\<\{ `historyComplete`: `boolean`; `policy`: `Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>; `recentSuppressions`: `object`[]; \} \| `undefined`\>

#### Parameters

##### target

[`ContactPolicySettingsTarget`](/api/engagement-drizzle/src/type-aliases/contactpolicysettingstarget/)

#### Returns

`Promise`\<\{ `historyComplete`: `boolean`; `policy`: `Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>; `recentSuppressions`: `object`[]; \} \| `undefined`\>

---

### loadPolicy()

> **loadPolicy**(`scope`): `Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\> \| `undefined`\>

#### Parameters

##### scope

[`ContactPolicyScope`](/api/engagement-core/src/type-aliases/contactpolicyscope/)

#### Returns

`Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\> \| `undefined`\>

---

### save()

> **save**(`input`): `Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>

#### Parameters

##### input

[`SaveContactPolicySettings`](/api/engagement-drizzle/src/type-aliases/savecontactpolicysettings/)

#### Returns

`Promise`\<`Readonly`\<\{ `config`: [`ContactPolicyConfig`](/api/engagement-core/src/type-aliases/contactpolicyconfig/); `revision`: `number`; `topics`: readonly `Readonly`\<\{ `id`: `string`; `kind`: `"marketing"` \| `"transactional"` \| `"security"`; `messageIds`: readonly `string`[]; `priority`: `number`; \}\>[]; \}\>\>
