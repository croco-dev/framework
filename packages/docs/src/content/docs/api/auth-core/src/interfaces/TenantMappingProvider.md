---
editUrl: false
next: false
prev: false
title: "TenantMappingProvider"
---

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:1](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L1)

사용자와 tenant 정보를 연결하는 매핑 공급자 계약입니다.

## Methods

### register()

> **register**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:3](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L3)

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

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L4)

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

***

### resolve()

> **resolve**(`externalOrgId`): `Promise`\<`string` \| `null`\>

Defined in: [packages/auth-core/src/libs/interfaces/TenantMapping.ts:2](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/auth-core/src/libs/interfaces/TenantMapping.ts#L2)

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`string` \| `null`\>
