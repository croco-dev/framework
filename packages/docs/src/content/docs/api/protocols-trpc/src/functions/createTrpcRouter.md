---
editUrl: false
next: false
prev: false
title: "createTrpcRouter"
---

> **createTrpcRouter**(`controllers`, `options?`): `AnyRouter`

Creates a tRPC router whose procedures run Croco guards before input parsing, then interceptors around handlers.

Class lifecycle metadata runs before method metadata. Filters run in the same order for any guard, validation,
interceptor, or handler failure. A filter must return RFC 7807 Problem Details with a 4xx or 5xx status; other
filter response shapes leave the original failure intact and emit `CROCO_TRPC_FILTER_001` to the runtime inspector.

## Parameters

### controllers

`Function`[]

### options?

[`TrpcRouterOptions`](/api/protocols-trpc/src/type-aliases/trpcrouteroptions/) = `{}`

## Returns

`AnyRouter`
