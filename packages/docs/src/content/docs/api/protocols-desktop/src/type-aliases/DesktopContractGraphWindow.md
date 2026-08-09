---
editUrl: false
next: false
prev: false
title: "DesktopContractGraphWindow"
---

> **DesktopContractGraphWindow** = `object`

## Properties

### exposedCommands

> `readonly` **exposedCommands**: readonly `string`[]

***

### id

> `readonly` **id**: `string`

***

### originPolicy

> `readonly` **originPolicy**: \{ `mode`: `"local-content"`; \} \| \{ `allowedOrigins`: readonly `string`[]; `initialUrl`: `string`; `mode`: `"remote-allowlist"`; \}

***

### receivedEvents

> `readonly` **receivedEvents**: readonly `string`[]

***

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`DesktopWireSourceLocation`](/api/protocols-desktop/src/type-aliases/desktopwiresourcelocation/)

***

### trust

> `readonly` **trust**: `"local"` \| `"remote"`
