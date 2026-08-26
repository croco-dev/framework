---
editUrl: false
next: false
prev: false
title: "defineEventTrigger"
---

Serializable typed trigger references.

## Call Signature

> **defineEventTrigger**\<`Payload`, `Result`\>(): `EventTriggerFactory`\<`Payload`, `Result`\>

Defines a serializable event trigger while retaining its handler payload and result contract.

### Type Parameters

#### Payload

`Payload` = `unknown`

#### Result

`Result` = `void`

### Returns

`EventTriggerFactory`\<`Payload`, `Result`\>

## Call Signature

> **defineEventTrigger**\<`Name`\>(`name`): [`EventTriggerRef`](/api/triggers-core/src/type-aliases/eventtriggerref/)\<`unknown`, `void`, `Name`\>

Defines a serializable event trigger while retaining its handler payload and result contract.

### Type Parameters

#### Name

`Name` _extends_ `string`

### Parameters

#### name

`Name`

### Returns

[`EventTriggerRef`](/api/triggers-core/src/type-aliases/eventtriggerref/)\<`unknown`, `void`, `Name`\>
