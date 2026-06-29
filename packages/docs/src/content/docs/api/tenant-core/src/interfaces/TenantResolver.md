---
editUrl: false
next: false
prev: false
title: "TenantResolver"
---

Strategy interface for resolving tenant ID from a request.
Implement this interface to support different tenant identification methods.

## Type Parameters

### TRequest

`TRequest` = `unknown`

The type of request object (e.g., HTTP request, context)

## Methods

### resolve()

> **resolve**(`request`): `Promise`\<`string` \| `null`\>

Resolve the tenant ID from the given request.

#### Parameters

##### request

`TRequest`

The incoming request object

#### Returns

`Promise`\<`string` \| `null`\>

The tenant ID if found, null otherwise
