---
editUrl: false
next: false
prev: false
title: "RscRenderOptions"
---

> **RscRenderOptions** = `object`

## Properties

### clientBuildId?

> `readonly` `optional` **clientBuildId?**: `string`

Identifier of the client build this server renders for. When given, the
negotiated manifest version is `composeRscClientManifestVersion(buildId)`
instead of the bare protocol constant.

---

### clientManifestVersion?

> `readonly` `optional` **clientManifestVersion?**: `string`

---

### encodeFlight?

> `readonly` `optional` **encodeFlight?**: [`RscFlightEncoder`](/api/meta-vite/src/type-aliases/rscflightencoder/)
