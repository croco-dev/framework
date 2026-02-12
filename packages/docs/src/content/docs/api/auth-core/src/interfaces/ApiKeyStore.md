---
editUrl: false
next: false
prev: false
title: "ApiKeyStore"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:4](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L4)

## Methods

### delete()

> **delete**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:11](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L11)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### findById()

> **findById**(`id`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:5](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L5)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

***

### findByShortToken()

> **findByShortToken**(`shortToken`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:6](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L6)

#### Parameters

##### shortToken

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

***

### listByTenant()

> **listByTenant**(`tenantId`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:10](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L10)

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

***

### revoke()

> **revoke**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:9](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L9)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### save()

> **save**(`key`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:7](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L7)

#### Parameters

##### key

`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

***

### updateLastUsed()

> **updateLastUsed**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:8](https://github.com/croco-dev/shared/blob/59966731a6b54d48b10479bc8fd9da97089758ba/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L8)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>
