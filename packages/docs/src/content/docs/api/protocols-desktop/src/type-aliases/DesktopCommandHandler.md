---
editUrl: false
next: false
prev: false
title: "DesktopCommandHandler"
---

> **DesktopCommandHandler**\<`TCommand`, `TContract`\> = (`input`, `context`) => [`DesktopResult`](/api/protocols-desktop/src/type-aliases/desktopresult/)\<[`InferDesktopCommandOutput`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandoutput/)\<`TCommand`\>, [`InferDesktopCommandProblem`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandproblem/)\<`TCommand`\>\> \| `Promise`\<[`DesktopResult`](/api/protocols-desktop/src/type-aliases/desktopresult/)\<[`InferDesktopCommandOutput`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandoutput/)\<`TCommand`\>, [`InferDesktopCommandProblem`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandproblem/)\<`TCommand`\>\>\>

## Type Parameters

### TCommand

`TCommand` _extends_ [`AnyDesktopCommand`](/api/protocols-desktop/src/type-aliases/anydesktopcommand/)

### TContract

`TContract` _extends_ [`AnyDesktopContract`](/api/protocols-desktop/src/type-aliases/anydesktopcontract/)

## Parameters

### input

[`InferDesktopCommandInput`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandinput/)\<`TCommand`\>

### context

[`DesktopHandlerContext`](/api/protocols-desktop/src/type-aliases/desktophandlercontext/)\<`TCommand`, `TContract`\>

## Returns

[`DesktopResult`](/api/protocols-desktop/src/type-aliases/desktopresult/)\<[`InferDesktopCommandOutput`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandoutput/)\<`TCommand`\>, [`InferDesktopCommandProblem`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandproblem/)\<`TCommand`\>\> \| `Promise`\<[`DesktopResult`](/api/protocols-desktop/src/type-aliases/desktopresult/)\<[`InferDesktopCommandOutput`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandoutput/)\<`TCommand`\>, [`InferDesktopCommandProblem`](/api/protocols-desktop/src/type-aliases/inferdesktopcommandproblem/)\<`TCommand`\>\>\>
