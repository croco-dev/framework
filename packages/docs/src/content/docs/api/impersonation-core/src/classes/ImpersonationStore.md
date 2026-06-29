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

### find()

> `abstract` **find**(`sessionId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

***

### findByImpersonator()

> `abstract` **findByImpersonator**(`impersonatorId`): `Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

#### Parameters

##### impersonatorId

`string`

#### Returns

`Promise`\<[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/) \| `null`\>

***

### revoke()

> `abstract` **revoke**(`sessionId`): `Promise`\<`void`\>

#### Parameters

##### sessionId

`string`

#### Returns

`Promise`\<`void`\>

***

### save()

> `abstract` **save**(`session`): `Promise`\<`void`\>

#### Parameters

##### session

[`ImpersonationState`](/api/impersonation-core/src/type-aliases/impersonationstate/)

#### Returns

`Promise`\<`void`\>
