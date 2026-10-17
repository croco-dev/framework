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

Identifier of the client build this server renders for. Used only when
`clientManifestVersion` is not given: the negotiated manifest version
becomes `composeRscClientManifestVersion(buildId)` instead of the bare
protocol constant. When both options are set, the explicit
`clientManifestVersion` wins.

---

### clientManifestVersion?

> `readonly` `optional` **clientManifestVersion?**: `string`

---

### encodeFlight?

> `readonly` `optional` **encodeFlight?**: [`RscFlightEncoder`](/api/meta-vite/src/type-aliases/rscflightencoder/)
