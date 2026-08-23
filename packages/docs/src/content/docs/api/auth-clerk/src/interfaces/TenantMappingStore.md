---
editUrl: false
next: false
prev: false
title: "TenantMappingStore"
---

Clerk tenant 매핑에 필요한 공개 타입입니다.

## Methods

### claim()

> **claim**(`externalOrgId`, `tenantId`): `Promise`\<[`TenantMappingClaimResult`](/api/auth-clerk/src/type-aliases/tenantmappingclaimresult/)\>

Creates the mapping only when the organization is unclaimed and returns the authoritative tenant.
Implementations must make the absence check and create one atomic operation across processes.

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<[`TenantMappingClaimResult`](/api/auth-clerk/src/type-aliases/tenantmappingclaimresult/)\>

---

### delete()

> **delete**(`externalOrgId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

---

### get()

> **get**(`externalOrgId`): `Promise`\<`string` \| `null`\>

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`string` \| `null`\>
