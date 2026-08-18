---
editUrl: false
next: false
prev: false
title: "AccessProvider"
---

## Methods

### check()

> **check**(`request`): `Promise`\<[`CheckResult`](/api/access-core/src/interfaces/checkresult/)\>

#### Parameters

##### request

[`CheckRequest`](/api/access-core/src/interfaces/checkrequest/)

#### Returns

`Promise`\<[`CheckResult`](/api/access-core/src/interfaces/checkresult/)\>

---

### grant()

> **grant**(`request`): `Promise`\<`void`\>

#### Parameters

##### request

[`GrantRequest`](/api/access-core/src/interfaces/grantrequest/)

#### Returns

`Promise`\<`void`\>

---

### list()

> **list**(`request`): `Promise`\<[`RelationTuple`](/api/access-core/src/interfaces/relationtuple/)[]\>

#### Parameters

##### request

[`ListRequest`](/api/access-core/src/interfaces/listrequest/)

#### Returns

`Promise`\<[`RelationTuple`](/api/access-core/src/interfaces/relationtuple/)[]\>

---

### revoke()

> **revoke**(`request`): `Promise`\<`void`\>

#### Parameters

##### request

[`RevokeRequest`](/api/access-core/src/interfaces/revokerequest/)

#### Returns

`Promise`\<`void`\>
