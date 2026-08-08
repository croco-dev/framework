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

`TGrant` *extends* [`KeyedDesktopGrant`](/api/protocols-desktop/src/type-aliases/keyeddesktopgrant/) = [`KeyedDesktopGrant`](/api/protocols-desktop/src/type-aliases/keyeddesktopgrant/)

### TContractKey

`TContractKey` *extends* `string` = `string`

### TMemberKey

`TMemberKey` *extends* `string` = `TGrant`\[`"memberKey"`\]
