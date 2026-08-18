---
editUrl: false
next: false
prev: false
title: "DesktopContractDefinition"
---

> **DesktopContractDefinition**\<`TCommands`, `TEvents`, `TGrants`\> = `object`

## Type Parameters

### TCommands

`TCommands` _extends_ [`DesktopCommandRecord`](/api/protocols-desktop/src/type-aliases/desktopcommandrecord/) = [`DesktopCommandRecord`](/api/protocols-desktop/src/type-aliases/desktopcommandrecord/)

### TEvents

`TEvents` _extends_ [`DesktopEventRecord`](/api/protocols-desktop/src/type-aliases/desktopeventrecord/) = [`DesktopEventRecord`](/api/protocols-desktop/src/type-aliases/desktopeventrecord/)

### TGrants

`TGrants` _extends_ [`DesktopGrantRecord`](/api/protocols-desktop/src/type-aliases/desktopgrantrecord/) = [`DesktopGrantRecord`](/api/protocols-desktop/src/type-aliases/desktopgrantrecord/)

## Properties

### commands

> `readonly` **commands**: `KeyedDesktopCommands`\<`TCommands`\>

---

### definitionType

> `readonly` **definitionType**: `"contract"`

---

### events

> `readonly` **events**: `KeyedDesktopEvents`\<`TEvents`\>

---

### grants

> `readonly` **grants**: `KeyedDesktopGrants`\<`TGrants`\>

---

### metadata

> `readonly` **metadata**: [`DesktopContractMetadata`](/api/protocols-desktop/src/type-aliases/desktopcontractmetadata/)
