---
editUrl: false
next: false
prev: false
title: "BoundDesktopContracts"
---

> **BoundDesktopContracts**\<`TContracts`\> = `{ readonly [TContractKey in keyof TContracts & string]: BoundDesktopContract<TContracts[TContractKey], TContractKey> }`

## Type Parameters

### TContracts

`TContracts` *extends* [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/)
