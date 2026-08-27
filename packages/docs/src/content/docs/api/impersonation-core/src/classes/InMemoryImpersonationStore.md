---
editUrl: false
next: false
prev: false
title: "InMemoryImpersonationStore"
---

## Extends

- [`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)

## Constructors

### Constructor

> **new InMemoryImpersonationStore**(): `InMemoryImpersonationStore`

#### Returns

`InMemoryImpersonationStore`

#### Inherited from

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`constructor`](/api/impersonation-core/src/classes/impersonationstore/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/)\>

#### Inherited from

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`token`](/api/impersonation-core/src/classes/impersonationstore/#token)

## Methods

### createIfNoActiveSession()

> **createIfNoActiveSession**(`session`): `Promise`\<[`ImpersonationSessionCreateResult`](/api/impersonation-core/src/type-aliases/impersonationsessioncreateresult/)\>

Atomically claims the session's impersonator and persists the session when no active session
owns that actor key. Persistent stores must enforce this boundary with a uniqueness constraint
or equivalent compare-and-set that replaces an expired owner in the same operation.

#### Parameters

##### session

[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)

#### Returns

`Promise`\<[`ImpersonationSessionCreateResult`](/api/impersonation-core/src/type-aliases/impersonationsessioncreateresult/)\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`createIfNoActiveSession`](/api/impersonation-core/src/classes/impersonationstore/#createifnoactivesession)

---

### find()

> **find**(`sessionId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`find`](/api/impersonation-core/src/classes/impersonationstore/#find)

---

### findByImpersonator()

> **findByImpersonator**(`impersonatorId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### impersonatorId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`findByImpersonator`](/api/impersonation-core/src/classes/impersonationstore/#findbyimpersonator)

---

### revoke()

> **revoke**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

#### Overrides

[`ImpersonationStore`](/api/impersonation-core/src/classes/impersonationstore/).[`revoke`](/api/impersonation-core/src/classes/impersonationstore/#revoke)
