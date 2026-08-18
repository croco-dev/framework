---
editUrl: false
next: false
prev: false
title: "defineMessage"
---

> **defineMessage**\<`TId`, `TTopic`, `TData`, `TChannels`\>(`input`): [`DefinedMessage`](/api/engagement-core/src/type-aliases/definedmessage/)\<`TId`, `TTopic`, `TData`, `TChannels`\>

Typed message contracts and explicit, decorator-bound renderer registration for Croco engagement.

## Type Parameters

### TId

`TId` _extends_ `string`

### TTopic

`TTopic` _extends_ `string`

### TData

`TData` _extends_ `ZodTypeAny`

### TChannels

`TChannels` _extends_ readonly \[`"email"` \| `"push"` \| `"sms"` \| `"inApp"`, `"email"` \| `"push"` \| `"sms"` \| `"inApp"`\]

## Parameters

### input

[`MessageDefinitionInput`](/api/engagement-core/src/type-aliases/messagedefinitioninput/)\<`TId`, `TTopic`, `TData`, `TChannels`\>

## Returns

[`DefinedMessage`](/api/engagement-core/src/type-aliases/definedmessage/)\<`TId`, `TTopic`, `TData`, `TChannels`\>
