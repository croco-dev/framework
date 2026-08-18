---
editUrl: false
next: false
prev: false
title: "CompileDesktopContractGraphOptions"
---

> **CompileDesktopContractGraphOptions** = `object`

## Properties

### sourceLocations?

> `readonly` `optional` **sourceLocations?**: [`DesktopContractGraphSourceLocations`](/api/protocols-desktop/src/type-aliases/desktopcontractgraphsourcelocations/)

Optional source evidence keyed by graph ID. Schema locations use the
`<command-id>.input`, `<command-id>.output`, and `<event-id>.payload` IDs.

---

### sourceRoot?

> `readonly` `optional` **sourceRoot?**: `string`

Root removed from source evidence before platform separators are canonicalized.
