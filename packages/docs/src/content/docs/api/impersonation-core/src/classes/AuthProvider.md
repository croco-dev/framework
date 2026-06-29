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

### getCurrentUserId()

> `abstract` **getCurrentUserId**(`context`): `string` \| `null`

#### Parameters

##### context

[`RequestContext`](/api/framework-context/src/interfaces/requestcontext/)

#### Returns

`string` \| `null`
