---
editUrl: false
next: false
prev: false
title: "DesktopAppDefinition"
---

> **DesktopAppDefinition**\<`TContracts`, `TWindows`\> = `object` & [`DesktopAppImplementer`](/api/protocols-desktop/src/type-aliases/desktopappimplementer/)\<`TContracts`\>

## Type Declaration

### contracts

> `readonly` **contracts**: [`BoundDesktopContracts`](/api/protocols-desktop/src/type-aliases/bounddesktopcontracts/)\<`TContracts`\>

### definitionType

> `readonly` **definitionType**: `"app"`

### metadata

> `readonly` **metadata**: [`DesktopAppMetadata`](/api/protocols-desktop/src/type-aliases/desktopappmetadata/)

### windows

> `readonly` **windows**: [`BoundDesktopWindows`](/api/protocols-desktop/src/type-aliases/bounddesktopwindows/)\<`TWindows`, `TContracts`\>

## Type Parameters

### TContracts

`TContracts` *extends* [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/) = [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/)

### TWindows

`TWindows` *extends* [`DesktopWindowRecord`](/api/protocols-desktop/src/type-aliases/desktopwindowrecord/) = [`DesktopWindowRecord`](/api/protocols-desktop/src/type-aliases/desktopwindowrecord/)
