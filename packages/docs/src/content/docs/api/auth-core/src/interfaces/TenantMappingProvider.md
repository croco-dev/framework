---
editUrl: false
next: false
prev: false
title: "TenantMappingProvider"
---

사용자와 tenant 정보를 연결하는 매핑 공급자 계약입니다.

## Methods

### register()

> **register**(`externalOrgId`, `tenantId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

##### tenantId

`string`

#### Returns

`Promise`\<`void`\>

---

### remove()

> **remove**(`externalOrgId`): `Promise`\<`void`\>

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`void`\>

---

### resolve()

> **resolve**(`externalOrgId`): `Promise`\<`string` \| `null`\>

#### Parameters

##### externalOrgId

`string`

#### Returns

`Promise`\<`string` \| `null`\>
