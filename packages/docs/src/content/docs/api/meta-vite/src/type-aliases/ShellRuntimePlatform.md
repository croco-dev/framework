---
editUrl: false
next: false
prev: false
title: "ShellRuntimePlatform"
---

> **ShellRuntimePlatform** = `"cloudflare"` \| `"lambda"` \| `"node"`

Minimal per-request runtime context for shell/region contracts.
Mirrors `RuntimeContext["platform"]` without importing render types so the
route contract layer stays free of render-layer dependencies.
