---
editUrl: false
next: false
prev: false
title: "createRscBrowserFlightHeaders"
---

> **createRscBrowserFlightHeaders**(`doc?`): `HeadersInit`

Headers a browser sends when it fetches a Flight node for the document it is
already running. The server embeds the version its HTML was rendered for, so
the browser echoes that value instead of guessing: requesting without it is
rejected exactly like a mismatched value.

## Parameters

### doc?

[`RscManifestDocument`](/api/meta-vite/src/type-aliases/rscmanifestdocument/)

## Returns

`HeadersInit`
