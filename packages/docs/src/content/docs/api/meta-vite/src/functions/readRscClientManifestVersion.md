---
editUrl: false
next: false
prev: false
title: "readRscClientManifestVersion"
---

> **readRscClientManifestVersion**(`doc`): `string` \| `null`

Reads the client manifest version the server rendered the current document
with. The JSON block is authoritative because `createRscHtmlShell` writes it
verbatim; the meta tag is the fallback for hosts that render only that.

## Parameters

### doc

[`RscManifestDocument`](/api/meta-vite/src/type-aliases/rscmanifestdocument/)

## Returns

`string` \| `null`
