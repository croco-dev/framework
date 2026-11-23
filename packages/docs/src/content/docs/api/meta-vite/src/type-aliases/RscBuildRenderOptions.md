---
editUrl: false
next: false
prev: false
title: "RscBuildRenderOptions"
---

> **RscBuildRenderOptions** = `object`

## Properties

### build

> `readonly` **build**: [`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/)

A production build from `loadRscBuild()`. RSC routes render in the
build's worker thread through the built `rsc` and `ssr` entries, and the
document loads the build's client entry, so the runtime context must be
plain data. The build also fixes the client manifest version, so the
encoder options cannot be combined with it.

---

### clientBuildId?

> `readonly` `optional` **clientBuildId?**: `never`

---

### clientManifestVersion?

> `readonly` `optional` **clientManifestVersion?**: `never`

---

### encodeFlight?

> `readonly` `optional` **encodeFlight?**: `never`
