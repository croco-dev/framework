---
editUrl: false
next: false
prev: false
title: "ContactPolicyConsoleProps"
---

> **ContactPolicyConsoleProps** = `Readonly`\<\{ `canWrite`: `boolean`; `registration`: [`ContactPolicyAdminRegistration`](/api/admin-core/src/type-aliases/contactpolicyadminregistration/); `state`: [`ContactPolicyConsoleState`](/api/admin-core/src/type-aliases/contactpolicyconsolestate/); `target`: [`ContactPolicyAdminScope`](/api/admin-core/src/type-aliases/contactpolicyadminscope/); `onDryRun`: `Promise`\<`Readonly`\<\{ `allowed`: `boolean`; `blockingCampaignIds?`: readonly `string`[]; `blockingRuleId`: `string` \| `null`; `nextEligibleAt?`: `Date`; `reason`: `"allowed"` \| `"limit"` \| `"spacing"` \| `"quiet-hours"` \| `"released"` \| `"unknown"`; \}\>\>; `onSave`: `Promise`\<`void`\>; \}\>
