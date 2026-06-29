---
editUrl: false
next: false
prev: false
title: "ImpersonationService"
---

## Constructors

### Constructor

> **new ImpersonationService**(`store`, `_authProvider`, `config`): `ImpersonationService`

#### Parameters

##### store

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)

##### \_authProvider

[`AuthProvider`](/api/impersonation-core/src/classes/authprovider/)

##### config

[`ImpersonationConfig`](/api/impersonation-core/src/type-aliases/impersonationconfig/)

#### Returns

`ImpersonationService`

## Properties

### \_authProvider

> `readonly` **\_authProvider**: [`AuthProvider`](/api/impersonation-core/src/classes/authprovider/)

## Methods

### end()

> **end**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

***

### getImpersonator()

> **getImpersonator**(`context`): `string` \| `null`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`string` \| `null`

***

### getTargetUser()

> **getTargetUser**(`context`): `string` \| `null`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`string` \| `null`

***

### isImpersonating()

> **isImpersonating**(`context`): `context is ImpersonationContext`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`context is ImpersonationContext`

***

### start()

> **start**(`impersonatorId`, `targetUserId`, `reason?`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)\>

#### Parameters

##### impersonatorId

`string`

##### targetUserId

`string`

##### reason?

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)\>
