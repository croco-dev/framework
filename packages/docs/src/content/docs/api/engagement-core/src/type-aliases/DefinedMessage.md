---
editUrl: false
next: false
prev: false
title: "DefinedMessage"
---

> **DefinedMessage**\<`TId`, `TTopic`, `TData`, `TChannels`\> = `Readonly`\<\{ `channels`: `TChannels`; `data`: `TData`; `descriptor`: [`MessageDescriptor`](/api/engagement-core/src/type-aliases/messagedescriptor/)\<`TChannels`\>; `id`: `TId`; `topic`: `TTopic`; \}\>

## Type Parameters

### TId

`TId` *extends* `string` = `string`

### TTopic

`TTopic` *extends* `string` = `string`

### TData

`TData` *extends* `z.ZodTypeAny` = `z.ZodTypeAny`

### TChannels

`TChannels` *extends* readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[] = readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[]
