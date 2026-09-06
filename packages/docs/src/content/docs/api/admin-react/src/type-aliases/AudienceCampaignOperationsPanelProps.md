---
editUrl: false
next: false
prev: false
title: "AudienceCampaignOperationsPanelProps"
---

> **AudienceCampaignOperationsPanelProps** = `object`

## Properties

### audienceEstimateResult?

> `readonly` `optional` **audienceEstimateResult?**: [`EngagementAudienceEstimateResult`](/api/admin-core/src/type-aliases/engagementaudienceestimateresult/)

---

### audiences

> `readonly` **audiences**: readonly [`EngagementAudienceDescriptorRow`](/api/admin-core/src/type-aliases/engagementaudiencedescriptorrow/)[]

---

### campaigns

> `readonly` **campaigns**: readonly [`EngagementCampaignDescriptorRow`](/api/admin-core/src/type-aliases/engagementcampaigndescriptorrow/)[]

---

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### onCancelCampaign?

> `readonly` `optional` **onCancelCampaign?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementCampaignCancelRequest`](/api/admin-core/src/type-aliases/engagementcampaigncancelrequest/)

#### Returns

`void`

---

### onCreateSnapshot?

> `readonly` `optional` **onCreateSnapshot?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementCampaignSnapshotRequest`](/api/admin-core/src/type-aliases/engagementcampaignsnapshotrequest/)

#### Returns

`void`

---

### onEstimateAudience?

> `readonly` `optional` **onEstimateAudience?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementAudienceEstimateRequest`](/api/admin-core/src/type-aliases/engagementaudienceestimaterequest/)

#### Returns

`void`

---

### onRunCampaign?

> `readonly` `optional` **onRunCampaign?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementCampaignRunRequest`](/api/admin-core/src/type-aliases/engagementcampaignrunrequest/)

#### Returns

`void`

---

### onSelectAudience?

> `readonly` `optional` **onSelectAudience?**: (`audienceId`) => `void`

#### Parameters

##### audienceId

`string`

#### Returns

`void`

---

### onSelectCampaign?

> `readonly` `optional` **onSelectCampaign?**: (`campaignId`) => `void`

#### Parameters

##### campaignId

`string`

#### Returns

`void`

---

### selectedAudienceId?

> `readonly` `optional` **selectedAudienceId?**: `string`

---

### selectedCampaignId?

> `readonly` `optional` **selectedCampaignId?**: `string`
