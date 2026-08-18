---
editUrl: false
next: false
prev: false
title: "TrpcRouterOptions"
---

> **TrpcRouterOptions** = `object`

## Properties

### container?

> `readonly` `optional` **container?**: `object`

#### get()

> **get**\<`T`\>(`type`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### type

[`Constructor`](/api/protocols-rest/src/type-aliases/constructor/)\<`T`\>

##### Returns

`T`

---

### createRequestContext?

> `readonly` `optional` **createRequestContext?**: (`context`) => [`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Parameters

##### context

`Record`\<`string`, `unknown`\>

#### Returns

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)
