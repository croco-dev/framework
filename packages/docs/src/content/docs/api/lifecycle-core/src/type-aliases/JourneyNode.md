---
editUrl: false
next: false
prev: false
title: "JourneyNode"
---

> **JourneyNode** = \{ `durationMs`: `number`; `id`: `string`; `kind`: `"wait"`; `next`: `string`; \} \| \{ `id`: `string`; `kind`: `"condition"`; `matched`: `string`; `predicate`: [`JourneyReference`](/api/lifecycle-core/src/type-aliases/journeyreference/); `unmatched`: `string`; \} \| \{ `action`: [`JourneyReference`](/api/lifecycle-core/src/type-aliases/journeyreference/); `id`: `string`; `kind`: `"action"`; `next`: `string`; \} \| \{ `id`: `string`; `kind`: `"end"`; \}
