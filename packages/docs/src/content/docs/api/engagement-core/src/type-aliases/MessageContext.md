---
editUrl: false
next: false
prev: false
title: "MessageContext"
---

> **MessageContext**\<`TMessage`, `TChannel`\> = `Readonly`\<\{ `channel`: `TChannel`; `data`: [`MessageData`](/api/engagement-core/src/type-aliases/messagedata/)\<`TMessage`\>; `message`: `TMessage`; \}\>

## Type Parameters

### TMessage

`TMessage` _extends_ [`AnyMessage`](/api/engagement-core/src/type-aliases/anymessage/)

### TChannel

`TChannel` _extends_ `MessageChannels`\<`TMessage`\> = `MessageChannels`\<`TMessage`\>
