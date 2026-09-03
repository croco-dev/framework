---
editUrl: false
next: false
prev: false
title: "CampaignMemberOutcome"
---

> **CampaignMemberOutcome** = `Readonly`\<\{ `executionIds?`: readonly `string`[]; `memberKey`: `string`; `reason?`: `string`; `recordedAt`: `Date`; `scope`: [`CampaignScopeRef`](/api/engagement-core/src/type-aliases/campaignscoperef/); `snapshotId`: `string`; \}\> & `Readonly`\<\{ `failureCode`: `string`; `retryable`: `boolean`; `status`: `"failed"`; \}\> \| `Readonly`\<\{ `failureCode?`: `never`; `retryable?`: `never`; `status`: `Exclude`\<[`CampaignMemberOutcomeStatus`](/api/engagement-core/src/type-aliases/campaignmemberoutcomestatus/), `"failed"`\>; \}\>
