---
editUrl: false
next: false
prev: false
title: "DesktopContractImplementation"
---

> **DesktopContractImplementation**\<`TContract`\> = `object`

## Type Parameters

### TContract

`TContract` *extends* [`AnyDesktopContract`](/api/protocols-desktop/src/type-aliases/anydesktopcontract/)

## Properties

### commands

> `readonly` **commands**: `{ readonly [TCommandKey in keyof TContract["commands"] & string]: DesktopCommandHandler<TContract["commands"][TCommandKey]> }`
