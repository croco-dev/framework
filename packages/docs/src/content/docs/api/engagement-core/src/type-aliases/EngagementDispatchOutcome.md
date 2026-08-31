---
editUrl: false
next: false
prev: false
title: "EngagementDispatchOutcome"
---

> **EngagementDispatchOutcome** = `Readonly`\<\{ `executionIds`: readonly `string`[]; `kind`: `"queued"`; `providerMessageIds?`: readonly `string`[]; \}\> \| `Readonly`\<\{ `kind`: `"suppressed"`; `reason`: `"preference"` \| `"suppression"`; \}\> \| `Readonly`\<\{ `kind`: `"unavailable"`; `reason`: `"no-endpoint"`; \}\> \| `Readonly`\<\{ `kind`: `"skipped"`; `reason`: `"policy"`; \}\> \| `Readonly`\<\{ `executionIds`: readonly `string`[]; `failureCode`: `string`; `kind`: `"failed"`; `retryable`: `boolean`; `stage`: `"preparation"` \| `"render"` \| `"provider"` \| `"network"` \| `"persistence"`; \}\>
