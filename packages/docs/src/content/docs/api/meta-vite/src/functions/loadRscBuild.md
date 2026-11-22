---
editUrl: false
next: false
prev: false
title: "loadRscBuild"
---

> **loadRscBuild**(`options`): `Promise`\<[`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/)\>

Loads a `@vitejs/plugin-rsc` production build into this process. Each
environment was bundled with its own React conditions at build time, so the
`rsc` and `ssr` entries run side by side without a child process. Every
artifact is checked here so a stale or partial build fails at startup.

## Parameters

### options

[`LoadRscBuildOptions`](/api/meta-vite/src/type-aliases/loadrscbuildoptions/)

## Returns

`Promise`\<[`RscBuild`](/api/meta-vite/src/type-aliases/rscbuild/)\>
