---
editUrl: false
next: false
prev: false
title: "EngagementDispatchOutcome"
---

> **EngagementDispatchOutcome** = `Readonly`\<\{ `executionIds`: readonly `string`[]; `kind`: `"queued"`; `providerMessageIds?`: readonly `string`[]; \}\> \| `Readonly`\<\{ `contactPolicy?`: `Readonly`\<\{ `app`: `string`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `campaignId?`: `string`; `environment`: `string`; `nextEligibleAt?`: `string`; `reason`: `string`; \}\>; `kind`: `"suppressed"`; `reason`: `"preference"` \| `"suppression"`; \}\> \| `Readonly`\<\{ `kind`: `"unavailable"`; `reason`: `"no-endpoint"`; \}\> \| `Readonly`\<\{ `kind`: `"skipped"`; `reason`: `"policy"`; \}\> \| `Readonly`\<\{ `executionIds`: readonly `string`[]; `failureCode`: `string`; `invalidEndpoint?`: `Readonly`\<\{ `endpointId`: `string`; `provider`: `string`; `providerCode?`: `string`; \}\>; `kind`: `"failed"`; `retryable`: `boolean`; `stage`: `"preparation"` \| `"render"` \| `"provider"` \| `"network"` \| `"persistence"`; \}\>
