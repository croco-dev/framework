---
editUrl: false
next: false
prev: false
title: "ImpersonationService"
---

## Constructors

### Constructor

> **new ImpersonationService**(`store`, `_authProvider`, `config`, `eventPublisher`): `ImpersonationService`

#### Parameters

##### store

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)

##### \_authProvider

[`AuthProvider`](/api/impersonation-core/src/classes/authprovider/)

##### config

[`ImpersonationConfig`](/api/impersonation-core/src/type-aliases/impersonationconfig/)

##### eventPublisher

[`ImpersonationLifecycleEventPublisher`](/api/impersonation-core/src/classes/impersonationlifecycleeventpublisher/)

#### Returns

`ImpersonationService`

## Properties

### \_authProvider

> `readonly` **\_authProvider**: [`AuthProvider`](/api/impersonation-core/src/classes/authprovider/)

## Methods

### end()

> **end**(`context`, `sessionId`): `Promise`\<`void`\>

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

---

### getImpersonator()

> **getImpersonator**(`context`): `string` \| `null`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`string` \| `null`

---

### getLifecycleDiagnostics()

> **getLifecycleDiagnostics**(`limit?`): `Promise`\<[`ImpersonationLifecycleDiagnostics`](/api/impersonation-core/src/type-aliases/impersonationlifecyclediagnostics/)\>

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<[`ImpersonationLifecycleDiagnostics`](/api/impersonation-core/src/type-aliases/impersonationlifecyclediagnostics/)\>

---

### getTargetUser()

> **getTargetUser**(`context`): `string` \| `null`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`string` \| `null`

---

### isImpersonating()

> **isImpersonating**(`context`): `context is ImpersonationContext`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`context is ImpersonationContext`

---

### publishPendingEvents()

> **publishPendingEvents**(`limit?`): `Promise`\<`number`\>

#### Parameters

##### limit?

`number` = `100`

#### Returns

`Promise`\<`number`\>

---

### start()

> **start**(`context`, `targetUserId`, `reason?`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)\>

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

##### targetUserId

`string`

##### reason?

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)\>
