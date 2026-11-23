---
editUrl: false
next: false
prev: false
title: "loadRscBuild"
---

> **loadRscBuild**(`options`): `Promise`\<[`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/)\>

Loads a `@vitejs/plugin-rsc` production build into a worker thread of its
own. plugin-rsc registers its module loaders on `globalThis`, so builds of
different apps must not share a thread. Every artifact is checked before the
promise resolves, so a stale or partial build fails at startup.

## Parameters

### options

[`LoadRscBuildOptions`](/api/meta-vite/src/type-aliases/loadrscbuildoptions/)

## Returns

`Promise`\<[`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/)\>
