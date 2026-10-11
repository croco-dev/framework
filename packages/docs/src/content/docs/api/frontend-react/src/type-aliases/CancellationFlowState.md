---
editUrl: false
next: false
prev: false
title: "CancellationFlowState"
---

> **CancellationFlowState** = `Readonly`\<\{ `kind`: `"loading"` \| `"empty"`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"error"` \| `"denied"`; \}\> \| `Readonly`\<\{ `kind`: `"ready"` \| `"partial"` \| `"conflict"`; `session`: [`CancellationSession`](/api/billing-core/src/type-aliases/cancellationsession/); \}\>

Partial retains the current authorized snapshot and quote; choice availability flags identify unavailable options.
