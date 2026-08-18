---
editUrl: false
next: false
prev: false
title: "CrocoApiHandlerResult"
---

> **CrocoApiHandlerResult** = \{ `handled`: `true`; `response`: `Response`; \} \| \{ `handled`: `false`; \}

API handler result type.
`{ handled: true; response: Response }` — API handler claimed the request.
{ handled: false } — API handler declined, page fallback MAY proceed.
