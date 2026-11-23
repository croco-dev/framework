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

The public origin this server answers for, such as `https://shop.example`.
Node HTTP servers build `request.url` from the client's `Host` header or
an absolute request target, so without it a client chooses the authority
a server component sees. Requests for another host get 400; accepted
requests are rewritten to this origin, so a server behind a proxy that
ends TLS still sees its public `https` URL.
