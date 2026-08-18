---
editUrl: false
next: false
prev: false
title: "DesktopAppImplementation"
---

> **DesktopAppImplementation**\<`TContracts`\> = `object`

## Type Parameters

### TContracts

`TContracts` _extends_ [`DesktopContractRecord`](/api/protocols-desktop/src/type-aliases/desktopcontractrecord/)

## Properties

### contracts

> `readonly` **contracts**: `{ readonly [TContractKey in keyof TContracts & string]: DesktopContractImplementation<TContracts[TContractKey]> }`
