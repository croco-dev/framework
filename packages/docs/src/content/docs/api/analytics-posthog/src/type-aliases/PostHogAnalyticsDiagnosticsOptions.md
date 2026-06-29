---
editUrl: false
next: false
prev: false
title: "PostHogAnalyticsDiagnosticsOptions"
---

> **PostHogAnalyticsDiagnosticsOptions** = `object`

## Properties

### enabled?

> `readonly` `optional` **enabled?**: `boolean`

***

### readinessCheck?

> `readonly` `optional` **readinessCheck?**: (`context`) => `Promise`\<[`PostHogAnalyticsReadinessCheckResult`](/api/analytics-posthog/src/type-aliases/posthoganalyticsreadinesscheckresult/) \| `void`\>

#### Parameters

##### context

[`PostHogAnalyticsReadinessCheckContext`](/api/analytics-posthog/src/type-aliases/posthoganalyticsreadinesscheckcontext/)

#### Returns

`Promise`\<[`PostHogAnalyticsReadinessCheckResult`](/api/analytics-posthog/src/type-aliases/posthoganalyticsreadinesscheckresult/) \| `void`\>
