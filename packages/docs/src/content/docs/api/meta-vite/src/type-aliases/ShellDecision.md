---
editUrl: false
next: false
prev: false
title: "ShellDecision"
---

> **ShellDecision** = \{ `kind`: `"render"`; \} \| \{ `kind`: `"notFound"`; \} \| \{ `kind`: `"redirect"`; `location`: `string`; `status?`: `301` \| `302` \| `303` \| `307` \| `308`; \} \| \{ `kind`: `"failed"`; `status`: `500` \| `502` \| `503` \| `504`; \}

Shell resolution for shell-first streaming SSR.

Resolve before the render commits response headers. Use it for existence,
authorization, redirect, and status decisions that must not change after
the shell flushes (404, login redirect, critical 5xx).
