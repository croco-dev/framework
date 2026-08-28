---
editUrl: false
next: false
prev: false
title: "EngagementSendResult"
---

> **EngagementSendResult** = `Readonly`\<\{ `channelResults`: readonly [`EngagementChannelResult`](/api/engagement-core/src/type-aliases/engagementchannelresult/)[]; `executionIds`: readonly `string`[]; `status`: `"queued"`; \}\> \| `Readonly`\<\{ `channelResults`: readonly [`EngagementChannelResult`](/api/engagement-core/src/type-aliases/engagementchannelresult/)[]; `reason`: `"preference"` \| `"suppression"` \| `"no-endpoint"`; `status`: `"suppressed"`; \}\>
