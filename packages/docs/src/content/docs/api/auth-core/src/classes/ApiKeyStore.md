---
editUrl: false
next: false
prev: false
title: "ApiKeyStore"
---

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L4)

Defines storage operations for API keys.

## Constructors

### Constructor

> **new ApiKeyStore**(): `ApiKeyStore`

#### Returns

`ApiKeyStore`

## Methods

### delete()

> `abstract` **delete**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:11](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L11)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### findById()

> `abstract` **findById**(`id`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L5)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

***

### findByShortToken()

> `abstract` **findByShortToken**(`shortToken`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L6)

#### Parameters

##### shortToken

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/) \| `null`\>

***

### listByTenant()

> `abstract` **listByTenant**(`tenantId`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:10](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L10)

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)[]\>

***

### revoke()

> `abstract` **revoke**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:9](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L9)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>

***

### save()

> `abstract` **save**(`key`): `Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L7)

#### Parameters

##### key

`Omit`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/), `"id"` \| `"createdAt"`\>

#### Returns

`Promise`\<[`ApiKey`](/api/auth-core/src/type-aliases/apikey/)\>

***

### updateLastUsed()

> `abstract` **updateLastUsed**(`id`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/apikey/ApiKeyStore.ts:8](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/apikey/ApiKeyStore.ts#L8)

#### Parameters

##### id

`string`

#### Returns

`Promise`\<`void`\>
