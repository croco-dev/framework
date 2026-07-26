---
editUrl: false
next: false
prev: false
title: "DesktopContractDefinition"
---

> **DesktopContractDefinition**\<`TCommands`, `TEvents`\> = `object`

## Type Parameters

### TCommands

`TCommands` *extends* [`DesktopCommandRecord`](/api/protocols-desktop/src/type-aliases/desktopcommandrecord/) = [`DesktopCommandRecord`](/api/protocols-desktop/src/type-aliases/desktopcommandrecord/)

### TEvents

`TEvents` *extends* [`DesktopEventRecord`](/api/protocols-desktop/src/type-aliases/desktopeventrecord/) = [`DesktopEventRecord`](/api/protocols-desktop/src/type-aliases/desktopeventrecord/)

## Properties

### commands

> `readonly` **commands**: `KeyedDesktopCommands`\<`TCommands`\>

***

### definitionType

> `readonly` **definitionType**: `"contract"`

***

### events

> `readonly` **events**: `KeyedDesktopEvents`\<`TEvents`\>

***

### metadata

> `readonly` **metadata**: [`DesktopContractMetadata`](/api/protocols-desktop/src/type-aliases/desktopcontractmetadata/)
