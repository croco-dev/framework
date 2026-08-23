---
editUrl: false
next: false
prev: false
title: "AccessEngine"
---

## Constructors

### Constructor

> **new AccessEngine**(`provider`, `options?`): `AccessEngine`

#### Parameters

##### provider

[`AccessProvider`](/api/access-core/src/interfaces/accessprovider/)

##### options?

[`AccessEngineOptions`](/api/access-core/src/type-aliases/accessengineoptions/) = `{}`

#### Returns

`AccessEngine`

## Methods

### check()

> **check**(`request`): `Promise`\<[`CheckResult`](/api/access-core/src/type-aliases/checkresult/)\>

#### Parameters

##### request

[`CheckRequest`](/api/access-core/src/interfaces/checkrequest/)

#### Returns

`Promise`\<[`CheckResult`](/api/access-core/src/type-aliases/checkresult/)\>

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

> **list**(`request`): `Promise`\<`Promise`\<[`RelationTuple`](/api/access-core/src/interfaces/relationtuple/)[]\>\>

#### Parameters

##### request

[`ListRequest`](/api/access-core/src/interfaces/listrequest/)

#### Returns

`Promise`\<`Promise`\<[`RelationTuple`](/api/access-core/src/interfaces/relationtuple/)[]\>\>

---

### revoke()

> **revoke**(`request`): `Promise`\<`void`\>

#### Parameters

##### request

[`RevokeRequest`](/api/access-core/src/interfaces/revokerequest/)

#### Returns

`Promise`\<`void`\>
