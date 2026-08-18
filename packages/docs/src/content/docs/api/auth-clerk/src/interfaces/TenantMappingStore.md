---
editUrl: false
next: false
prev: false
title: "TenantMappingStore"
---

Clerk tenant 매핑에 필요한 공개 타입입니다.

## Methods

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

---

### set()

> **set**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>
