---
editUrl: false
next: false
prev: false
title: "EngagementOperationsConsoleProps"
---

> **EngagementOperationsConsoleProps** = `object`

## Properties

### activeSection?

> `readonly` `optional` **activeSection?**: [`EngagementConsoleSection`](/api/admin-react/src/type-aliases/engagementconsolesection/)

---

### audienceEstimateResult?

> `readonly` `optional` **audienceEstimateResult?**: [`EngagementAudienceEstimateResult`](/api/admin-core/src/type-aliases/engagementaudienceestimateresult/)

---

### filter?

> `readonly` `optional` **filter?**: [`EngagementDeliveryFilter`](/api/admin-core/src/type-aliases/engagementdeliveryfilter/)

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

### onCreateSuppression?

> `readonly` `optional` **onCreateSuppression?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementCreateSuppressionRequest`](/api/admin-core/src/type-aliases/engagementcreatesuppressionrequest/)

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

### onFilterChange?

> `readonly` `optional` **onFilterChange?**: (`filter`) => `void`

#### Parameters

##### filter

[`EngagementDeliveryFilter`](/api/admin-core/src/type-aliases/engagementdeliveryfilter/)

#### Returns

`void`

---

### onPreviewMessage?

> `readonly` `optional` **onPreviewMessage?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementMessagePreviewRequest`](/api/admin-core/src/type-aliases/engagementmessagepreviewrequest/)

#### Returns

`void`

---

### onReactivateEndpoint?

> `readonly` `optional` **onReactivateEndpoint?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementReactivateEndpointRequest`](/api/admin-core/src/type-aliases/engagementreactivateendpointrequest/)

#### Returns

`void`

---

### onRefresh?

> `readonly` `optional` **onRefresh?**: () => `void`

#### Returns

`void`

---

### onRemoveSuppression?

> `readonly` `optional` **onRemoveSuppression?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementRemoveSuppressionRequest`](/api/admin-core/src/type-aliases/engagementremovesuppressionrequest/)

#### Returns

`void`

---

### onRetryDispatch?

> `readonly` `optional` **onRetryDispatch?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementRetryDispatchRequest`](/api/admin-core/src/type-aliases/engagementretrydispatchrequest/)

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

### onSectionChange?

> `readonly` `optional` **onSectionChange?**: (`section`) => `void`

#### Parameters

##### section

[`EngagementConsoleSection`](/api/admin-react/src/type-aliases/engagementconsolesection/)

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

### onSelectMessage?

> `readonly` `optional` **onSelectMessage?**: (`messageId`) => `void`

#### Parameters

##### messageId

`string`

#### Returns

`void`

---

### onSelectRecipient?

> `readonly` `optional` **onSelectRecipient?**: (`recipientId`) => `void`

#### Parameters

##### recipientId

`string`

#### Returns

`void`

---

### onTestSend?

> `readonly` `optional` **onTestSend?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementTestSendRequest`](/api/admin-core/src/type-aliases/engagementtestsendrequest/)

#### Returns

`void`

---

### previewResult?

> `readonly` `optional` **previewResult?**: [`EngagementMessagePreviewResult`](/api/admin-core/src/type-aliases/engagementmessagepreviewresult/)

---

### selectedCampaignId?

> `readonly` `optional` **selectedCampaignId?**: `string`

---

### selectedMessageId?

> `readonly` `optional` **selectedMessageId?**: `string`

---

### selectedRecipientId?

> `readonly` `optional` **selectedRecipientId?**: `string`

---

### state

> `readonly` **state**: [`EngagementOperationsState`](/api/admin-core/src/type-aliases/engagementoperationsstate/)

---

### testSendResult?

> `readonly` `optional` **testSendResult?**: [`EngagementTestSendResult`](/api/admin-core/src/type-aliases/engagementtestsendresult/)
