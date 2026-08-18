---
editUrl: false
next: false
prev: false
title: "MessageDefinitionInput"
---

> **MessageDefinitionInput**\<`TId`, `TTopic`, `TData`, `TChannels`\> = `object`

## Type Parameters

### TId

`TId` *extends* `string` = `string`

### TTopic

`TTopic` *extends* `string` = `string`

### TData

`TData` *extends* `z.ZodTypeAny` = `z.ZodTypeAny`

### TChannels

`TChannels` *extends* readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[] = readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[]

## Properties

### channels

> `readonly` **channels**: `TChannels`

***

### data

> `readonly` **data**: `TData`

***

### id

> `readonly` **id**: `TId`

***

### topic

> `readonly` **topic**: `TTopic`
