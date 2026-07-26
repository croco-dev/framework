---
editUrl: false
next: false
prev: false
title: "OutboundWebhookOutcomeClassification"
---

> **OutboundWebhookOutcomeClassification** = \{ `policy`: `"accepted"`; \} \| \{ `policy`: `"delivered"`; \} \| \{ `policy`: `"permanent"`; `problem`: [`Problem`](/api/problems-core/src/classes/problem/); \} \| \{ `policy`: `"retryable"`; `problem`: [`Problem`](/api/problems-core/src/classes/problem/); `retryAfterMs?`: `number`; \} \| \{ `policy`: `"acceptance-unknown"`; `problem`: [`Problem`](/api/problems-core/src/classes/problem/); \}
