---
editUrl: false
next: false
prev: false
title: "NodeHandlerOptions"
---

> **NodeHandlerOptions** = `object`

## Properties

### origin?

> `readonly` `optional` **origin?**: `string`

The only origin this server answers for, such as `https://shop.example`.
Node HTTP servers build `request.url` from the client's `Host` header or
an absolute request target, so without it a client chooses the origin a
server component sees. Requests for any other origin get 400.
