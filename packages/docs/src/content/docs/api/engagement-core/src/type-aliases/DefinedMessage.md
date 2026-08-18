---
editUrl: false
next: false
prev: false
title: "DefinedMessage"
---

> **DefinedMessage**\<`TId`, `TTopic`, `TData`, `TChannels`\> = `Readonly`\<\{ `channels`: `TChannels`; `data`: `TData`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<`TChannels`\>; `id`: `TId`; `topic`: `TTopic`; \}\>

## Type Parameters

### TId

`TId` _extends_ `string` = `string`

### TTopic

`TTopic` _extends_ `string` = `string`

### TData

`TData` _extends_ `z.ZodTypeAny` = `z.ZodTypeAny`

### TChannels

`TChannels` _extends_ readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[] = readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[]
