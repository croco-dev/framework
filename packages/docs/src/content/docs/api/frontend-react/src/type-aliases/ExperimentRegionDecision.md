---
editUrl: false
next: false
prev: false
title: "ExperimentRegionDecision"
---

> **ExperimentRegionDecision** = `Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"speculative"` \| `"admitted"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `boolean` \| `number`; `variant?`: `string`; \}\>

Public projection only. Receipt is opaque; scopeKey is a host-owned session generation, not a subject id.
