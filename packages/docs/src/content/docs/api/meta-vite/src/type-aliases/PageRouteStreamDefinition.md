---
editUrl: false
next: false
prev: false
title: "PageRouteStreamDefinition"
---

> **PageRouteStreamDefinition** = `object`

## Properties

### regions?

> `readonly` `optional` **regions?**: readonly [`DeferredRegionDefinition`](/api/meta-vite/src/type-aliases/deferredregiondefinition/)[]

Deferred regions streamed after the shell.

---

### resolveShell?

> `readonly` `optional` **resolveShell?**: (`input`) => `Promise`\<[`ShellDecision`](/api/meta-vite/src/type-aliases/shelldecision/)\>

Resolve existence/auth/redirect/status before header commit.

#### Parameters

##### input

[`ShellDecisionInput`](/api/meta-vite/src/type-aliases/shelldecisioninput/)

#### Returns

`Promise`\<[`ShellDecision`](/api/meta-vite/src/type-aliases/shelldecision/)\>

---

### stream?

> `readonly` `optional` **stream?**: [`ShellRenderOptions`](/api/meta-vite/src/type-aliases/shellrenderoptions/)

Shell render policy for this route.
