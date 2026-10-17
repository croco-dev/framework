---
editUrl: false
next: false
prev: false
title: "ExperimentRenderDecision"
---

> **ExperimentRenderDecision** = `Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"speculative"` \| `"admitted"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `boolean` \| `number`; `variant?`: `string`; \}\>

Browser-safe render data: no subject, traits, source snapshot, provider metadata or handler.
