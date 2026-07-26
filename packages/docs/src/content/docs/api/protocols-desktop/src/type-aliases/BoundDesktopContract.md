---
editUrl: false
next: false
prev: false
title: "BoundDesktopContract"
---

> **BoundDesktopContract**\<`TContract`, `TContractKey`\> = `object`

## Type Parameters

### TContract

`TContract` *extends* [`AnyDesktopContract`](/api/protocols-desktop/src/type-aliases/anydesktopcontract/)

### TContractKey

`TContractKey` *extends* `string`

## Properties

### commands

> `readonly` **commands**: `{ readonly [TMemberKey in keyof TContract["commands"] & string]: BoundDesktopCommand<TContract["commands"][TMemberKey], TContractKey, TMemberKey> }`

***

### contractKey

> `readonly` **contractKey**: `TContractKey`

***

### definitionType

> `readonly` **definitionType**: `"contract"`

***

### events

> `readonly` **events**: `{ readonly [TMemberKey in keyof TContract["events"] & string]: BoundDesktopEvent<TContract["events"][TMemberKey], TContractKey, TMemberKey> }`

***

### metadata

> `readonly` **metadata**: [`DesktopContractMetadata`](/api/protocols-desktop/src/type-aliases/desktopcontractmetadata/)
