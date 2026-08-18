---
editUrl: false
next: false
prev: false
title: "BoundDesktopWindows"
---

> **BoundDesktopWindows**\<`TWindows`, `TContracts`\> = `{ readonly [TWindowKey in keyof TWindows & string]: BoundDesktopWindow<TWindows[TWindowKey], TContracts> }`

## Type Parameters

### TWindows

`TWindows` _extends_ [`DesktopWindowRecord`](/api/protocols-desktop/src/type-aliases/desktopwindowrecord/)

### TContracts

`TContracts` _extends_ [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/)
