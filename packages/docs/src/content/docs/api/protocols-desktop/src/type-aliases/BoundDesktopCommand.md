---
editUrl: false
next: false
prev: false
title: "BoundDesktopCommand"
---

> **BoundDesktopCommand**\<`TCommand`, `TContractKey`, `TMemberKey`\> = `TCommand` & `object`

## Type Declaration

### contractKey

> `readonly` **contractKey**: `TContractKey`

### id

> `readonly` **id**: `` `${TContractKey}.${TMemberKey}` ``

## Type Parameters

### TCommand

`TCommand` _extends_ [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/) = [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)

### TContractKey

`TContractKey` _extends_ `string` = `string`

### TMemberKey

`TMemberKey` _extends_ `string` = `TCommand`\[`"memberKey"`\]
