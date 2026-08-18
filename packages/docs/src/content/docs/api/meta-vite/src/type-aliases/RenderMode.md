---
editUrl: false
next: false
prev: false
title: "RenderMode"
---

> **RenderMode** = `"ssr"` \| `"ssg"` \| `"isr"` \| `"rsc"`

Render mode for each page route.

- ssr: server-side render every request (default)
- ssg: static site generation (pre-rendered at build)
- isr: incremental static regeneration (TTL-based revalidation)
- rsc: React Server Components (streaming RSC payload)
