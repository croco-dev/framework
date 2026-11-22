---
editUrl: false
next: false
prev: false
title: "RscBuild"
---

> **RscBuild** = `object`

A validated production build: the built `rsc` and `ssr` entries loaded into
this process, plus the client build they were compiled against.

## Properties

### clientDir

> `readonly` **clientDir**: `string`

Absolute path of the client build output (`<outDir>/client`).

---

### clientEntryUrl

> `readonly` **clientEntryUrl**: `string`

---

### clientManifestVersion

> `readonly` **clientManifestVersion**: `string`

---

### routes

> `readonly` **routes**: readonly [`RenderRouteIR`](/api/meta-vite/src/type-aliases/renderrouteir/)[]

One `rsc`-mode route per route the built `rsc` entry declares.

---

### server

> `readonly` **server**: [`RscServerEntry`](/api/meta-vite/src/type-aliases/rscserverentry/)

---

### ssr

> `readonly` **ssr**: [`RscSsrEntry`](/api/meta-vite/src/type-aliases/rscssrentry/)
