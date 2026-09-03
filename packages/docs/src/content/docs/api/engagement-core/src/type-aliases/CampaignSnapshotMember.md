---
editUrl: false
next: false
prev: false
title: "CampaignSnapshotMember"
---

> **CampaignSnapshotMember** = `CampaignSnapshotMemberIdentity` & `Readonly`\<\{ `data`: [`CampaignSnapshotValue`](/api/engagement-core/src/type-aliases/campaignsnapshotvalue/); `policy?`: [`EngagementDeliveryPolicy`](/api/engagement-core/src/type-aliases/engagementdeliverypolicy/); `recipient`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `state`: `"ready"`; \}\> \| `CampaignSnapshotMemberIdentity` & `Readonly`\<\{ `failureCode`: `string`; `recipient?`: [`RecipientRef`](/api/engagement-core/src/type-aliases/recipientref/); `state`: `"mapping-failed"`; \}\>
