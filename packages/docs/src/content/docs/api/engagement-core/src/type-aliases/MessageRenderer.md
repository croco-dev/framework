---
editUrl: false
next: false
prev: false
title: "MessageRenderer"
---

> **MessageRenderer**\<`TMessage`\> = `{ readonly [TChannel in MessageChannels<TMessage>]: RendererMethod<TMessage, TChannel> }` & `{ readonly [TChannel in Exclude<MessageChannel, MessageChannels<TMessage>>]?: never }`

A complete renderer for the exact channels declared by a message. The `never` members deliberately make
accidental renderer methods for undeclared first-party channels a TypeScript error.

## Type Parameters

### TMessage

`TMessage` _extends_ `AnyMessage`
