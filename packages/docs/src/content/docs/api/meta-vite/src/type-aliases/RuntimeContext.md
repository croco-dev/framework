---
editUrl: false
next: false
prev: false
title: "RuntimeContext"
---

> **RuntimeContext** = `object`

Provider-specific runtime context.
Each provider adapter fills only the fields available for that runtime.
Render core must guard before accessing optional fields.

## Properties

### env?

> `optional` **env?**: `unknown`

***

### event?

> `optional` **event?**: `unknown`

***

### executionContext?

> `optional` **executionContext?**: `unknown`

***

### lambdaContext?

> `optional` **lambdaContext?**: `unknown`

***

### platform

> **platform**: `"cloudflare"` \| `"lambda"` \| `"node"`
