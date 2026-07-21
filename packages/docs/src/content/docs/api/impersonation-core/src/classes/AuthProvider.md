---
editUrl: false
next: false
prev: false
title: "AuthProvider"
---

## Constructors

### Constructor

> **new AuthProvider**(): `AuthProvider`

#### Returns

`AuthProvider`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`AuthProvider`\>

## Methods

### resolvePrincipal()

> `abstract` **resolvePrincipal**(`context`): `Promise`\<[`ImpersonationPrincipal`](/api/impersonation-core/src/type-aliases/impersonationprincipal/) \| `null`\>

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`Promise`\<[`ImpersonationPrincipal`](/api/impersonation-core/src/type-aliases/impersonationprincipal/) \| `null`\>

***

### targetExists()

> `abstract` **targetExists**(`context`, `targetUserId`): `Promise`\<`boolean`\>

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

##### targetUserId

`string`

#### Returns

`Promise`\<`boolean`\>
