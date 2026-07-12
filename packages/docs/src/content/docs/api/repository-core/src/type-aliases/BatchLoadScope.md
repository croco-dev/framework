---
editUrl: false
next: false
prev: false
title: "BatchLoadScope"
---

> **BatchLoadScope** = `string` \| `number` \| `bigint` \| `boolean` \| `symbol` \| `object`

Opaque identity for the repository, tenant, data source, or transaction boundary that may
safely share one request-scoped loader.

Equal primitive values intentionally share. Use an object or symbol when reference identity
is required.
