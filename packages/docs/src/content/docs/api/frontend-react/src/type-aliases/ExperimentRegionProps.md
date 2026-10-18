---
editUrl: false
next: false
prev: false
title: "ExperimentRegionProps"
---

> **ExperimentRegionProps** = `Readonly`\<\{ `activeScopeKey`: `string`; `decision`: [`ExperimentRegionDecision`](/api/frontend-react/src/type-aliases/experimentregiondecision/); `fallback`: `ReactNode`; `scopeKey`: `string`; `admit?`: `Promise`\<`Readonly`\<\{ `deliveryId`: `string`; `experimentRevision`: `string`; `phase`: `"speculative"` \| `"admitted"`; `policyRevision`: `string`; `receipt?`: `string`; `region`: `string`; `status`: `"assigned"` \| `"fallback"`; `validUntil`: `string`; `value?`: `string` \| `boolean` \| `number`; `variant?`: `string`; \}\>\>; `onObservationError?`: `void`; `renderVariant`: `ReactNode`; `report`: `Promise`\<`void`\>; \}\>
