---
editUrl: false
next: false
prev: false
title: "TenantMappingProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:1](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L1)

Contract for mapping identities to tenant information.

## Methods

### register()

> **register**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:3](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L3)

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>

***

### remove()

> **remove**(`externalOrgId`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L4)

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

***

### resolve()

> **resolve**(`externalOrgId`): `Promise`\<`string` \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:2](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L2)

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`string` \| `null`\>
