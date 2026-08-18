---
editUrl: false
next: false
prev: false
title: "DesktopAppImplementer"
---

> **DesktopAppImplementer**\<`TContracts`\> = `object`

## Type Parameters

### TContracts

`TContracts` *extends* [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/)

## Properties

### implement

> `readonly` **implement**: \<`TImplementation`\>(`implementation`) => `void`

#### Type Parameters

##### TImplementation

`TImplementation` *extends* [`DesktopAppImplementation`](/api/protocols-desktop/src/type-aliases/desktopappimplementation/)\<`TContracts`\>

#### Parameters

##### implementation

`TImplementation` & `ExactDesktopAppImplementation`\<`TImplementation`, `TContracts`\>

#### Returns

`void`
