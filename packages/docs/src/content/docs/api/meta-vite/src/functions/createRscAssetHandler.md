---
editUrl: false
next: false
prev: false
title: "createRscAssetHandler"
---

> **createRscAssetHandler**(`build`): [`RscAssetHandler`](/api/meta-vite/src/type-aliases/rscassethandler/)

Serves the hashed client bundle under `/assets/`. Every file name carries a
content hash, so responses are cacheable forever. The shape fits the
`apiHandlers` of `createNodeComposedHandler`.

## Parameters

### build

`Pick`\<[`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/), `"clientDir"`\>

## Returns

[`RscAssetHandler`](/api/meta-vite/src/type-aliases/rscassethandler/)
