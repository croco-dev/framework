---
editUrl: false
next: false
prev: false
title: "EngagementChannelResult"
---

> **EngagementChannelResult** = `Readonly`\<\{ `channel`: [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/); `executionIds`: readonly `string`[]; `status`: `"queued"`; \}\> \| `Readonly`\<\{ `channel`: [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/); `reason`: `"preference"` \| `"suppression"`; `status`: `"suppressed"`; \}\> \| `Readonly`\<\{ `channel`: [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/); `reason`: `"no-endpoint"`; `status`: `"unavailable"`; \}\> \| `Readonly`\<\{ `channel`: [`MessageChannel`](/api/engagement-core/src/type-aliases/messagechannel/); `reason`: `"policy"`; `status`: `"skipped"`; \}\>
