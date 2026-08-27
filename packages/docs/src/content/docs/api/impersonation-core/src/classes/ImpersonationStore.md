---
editUrl: false
next: false
prev: false
title: "ImpersonationStore"
---

## Extended by

- [`InMemoryImpersonationStore`](/api/impersonation-core/src/classes/inmemoryimpersonationstore/)

## Constructors

### Constructor

> **new ImpersonationStore**(): `ImpersonationStore`

#### Returns

`ImpersonationStore`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`ImpersonationStore`\>

## Methods

### createIfNoActiveSession()

> `abstract` **createIfNoActiveSession**(`session`): `Promise`\<[`ImpersonationSessionCreateResult`](/api/impersonation-core/src/type-aliases/impersonationsessioncreateresult/)\>

Atomically claims the session's impersonator and persists the session when no active session
owns that actor key. Persistent stores must enforce this boundary with a uniqueness constraint
or equivalent compare-and-set that replaces an expired owner in the same operation.

#### Parameters

##### session

[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)

#### Returns

`Promise`\<[`ImpersonationSessionCreateResult`](/api/impersonation-core/src/type-aliases/impersonationsessioncreateresult/)\>

---

### find()

> `abstract` **find**(`sessionId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

---

### findByImpersonator()

> `abstract` **findByImpersonator**(`impersonatorId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### impersonatorId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

---

### revoke()

> `abstract` **revoke**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>
