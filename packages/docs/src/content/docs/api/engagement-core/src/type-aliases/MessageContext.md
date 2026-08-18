---
editUrl: false
next: false
prev: false
title: "MessageContext"
---

> **MessageContext**\<`TMessage`, `TChannel`\> = `Readonly`\<\{ `channel`: `TChannel`; `data`: [`MessageData`](/api/engagement-core/src/type-aliases/messagedata/)\<`TMessage`\>; `message`: `TMessage`; \}\>

## Type Parameters

### TMessage

`TMessage` *extends* `AnyMessage`

### TChannel

`TChannel` *extends* `MessageChannels`\<`TMessage`\> = `MessageChannels`\<`TMessage`\>
