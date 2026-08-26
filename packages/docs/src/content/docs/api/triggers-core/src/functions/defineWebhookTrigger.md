---
editUrl: false
next: false
prev: false
title: "defineWebhookTrigger"
---

Serializable typed trigger references.

## Call Signature

> **defineWebhookTrigger**\<`Request`, `Result`\>(): `WebhookTriggerFactory`\<`Request`, `Result`\>

Defines a serializable webhook trigger while retaining its handler request and result contract.

### Type Parameters

#### Request

`Request` = `unknown`

#### Result

`Result` = `void`

### Returns

`WebhookTriggerFactory`\<`Request`, `Result`\>

## Call Signature

> **defineWebhookTrigger**\<`Path`, `Method`\>(`path`, `method`): [`WebhookTriggerRef`](/api/triggers-core/src/type-aliases/webhooktriggerref/)\<`unknown`, `void`, `Path`, `NormalizedWebhookHttpMethod`\<`Method`\>\>

Defines a serializable webhook trigger while retaining its handler request and result contract.

### Type Parameters

#### Path

`Path` _extends_ `string`

#### Method

`Method` _extends_ `WebhookHttpMethodInput`

### Parameters

#### path

`Path`

#### method

`Method`

### Returns

[`WebhookTriggerRef`](/api/triggers-core/src/type-aliases/webhooktriggerref/)\<`unknown`, `void`, `Path`, `NormalizedWebhookHttpMethod`\<`Method`\>\>
