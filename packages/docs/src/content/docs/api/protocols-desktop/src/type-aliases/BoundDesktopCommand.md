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

`TCommand` *extends* [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/) = [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)

### TContractKey

`TContractKey` *extends* `string` = `string`

### TMemberKey

`TMemberKey` *extends* `string` = `TCommand`\[`"memberKey"`\]
