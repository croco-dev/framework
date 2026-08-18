---
editUrl: false
next: false
prev: false
title: "MessageDefinitionInput"
---

> **MessageDefinitionInput**\<`TId`, `TTopic`, `TData`, `TChannels`\> = `object`

## Type Parameters

### TId

`TId` _extends_ `string` = `string`

### TTopic

`TTopic` _extends_ `string` = `string`

### TData

`TData` _extends_ `z.ZodTypeAny` = `z.ZodTypeAny`

### TChannels

`TChannels` _extends_ readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[] = readonly [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/)[]

## Properties

### channels

> `readonly` **channels**: `TChannels`

---

### data

> `readonly` **data**: `TData`

---

### id

> `readonly` **id**: `TId`

---

### topic

> `readonly` **topic**: `TTopic`
