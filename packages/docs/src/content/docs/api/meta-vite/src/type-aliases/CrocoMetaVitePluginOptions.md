---
editUrl: false
next: false
prev: false
title: "CrocoMetaVitePluginOptions"
---

> **CrocoMetaVitePluginOptions** = `object`

## Properties

### rsc?

> `optional` **rsc?**: `boolean`

Enable the `rsc` Vite environment (real React Flight path). Opt-in:
the default (`false`/omitted) configures only `client` + `ssr` so
consumers without the optional `@vitejs/plugin-rsc` peer keep working.
Pass `{ rsc: true }` only when the peer is installed.
