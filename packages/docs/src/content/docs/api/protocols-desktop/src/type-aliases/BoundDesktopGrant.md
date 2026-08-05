---
editUrl: false
next: false
prev: false
title: "BoundDesktopGrant"
---

> **BoundDesktopGrant**\<`TGrant`, `TContractKey`, `TMemberKey`\> = `TGrant` & `object`

## Type Declaration

### contractKey

> `readonly` **contractKey**: `TContractKey`

### id

> `readonly` **id**: `` `${TContractKey}.${TMemberKey}` ``

## Type Parameters

### TGrant

`TGrant` _extends_ [`KeyedDesktopGrant`](/api/protocols-desktop/src/type-aliases/keyeddesktopgrant/) = [`KeyedDesktopGrant`](/api/protocols-desktop/src/type-aliases/keyeddesktopgrant/)

### TContractKey

`TContractKey` _extends_ `string` = `string`

### TMemberKey

`TMemberKey` _extends_ `string` = `TGrant`\[`"memberKey"`\]
