---
editUrl: false
next: false
prev: false
title: "shortCircuit"
---

> **shortCircuit**(`reason?`): [`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/)

Marks an HTTP middleware as intentionally ending the middleware chain without calling next().

## Parameters

### reason?

`string` = `DEFAULT_SHORT_CIRCUIT_REASON`

## Returns

[`MiddlewareShortCircuit`](/api/transports-http/src/type-aliases/middlewareshortcircuit/)
