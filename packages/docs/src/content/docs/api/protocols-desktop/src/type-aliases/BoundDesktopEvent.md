---
editUrl: false
next: false
prev: false
title: "BoundDesktopEvent"
---

> **BoundDesktopEvent**\<`TEvent`, `TContractKey`, `TMemberKey`\> = `TEvent` & `object`

## Type Declaration

### contractKey

> `readonly` **contractKey**: `TContractKey`

### id

> `readonly` **id**: `` `${TContractKey}.${TMemberKey}` ``

## Type Parameters

### TEvent

`TEvent` *extends* [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/) = [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)

### TContractKey

`TContractKey` *extends* `string` = `string`

### TMemberKey

`TMemberKey` *extends* `string` = `TEvent`\[`"memberKey"`\]
