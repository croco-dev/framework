---
editUrl: false
next: false
prev: false
title: "RscServerAction"
---

> **RscServerAction** = (`input`, `options`) => `unknown`

Server work that must share module state with rendering, such as a cache the
rendered page fills. Input must be plain data; the result is structured-cloned
back to the host, so return plain data.

## Parameters

### input

`unknown`

### options

[`RscServerActionOptions`](/api/meta-vite/src/type-aliases/rscserveractionoptions/)

## Returns

`unknown`
