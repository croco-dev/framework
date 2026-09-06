---
editUrl: false
next: false
prev: false
title: "Customer360CommunicationState"
---

> **Customer360CommunicationState** = `object`

## Properties

### audienceMemberships

> `readonly` **audienceMemberships**: readonly [`EngagementAudienceMembershipSummary`](/api/admin-core/src/type-aliases/engagementaudiencemembershipsummary/)[]

---

### customFields?

> `readonly` `optional` **customFields?**: `Readonly`\<`Record`\<`string`, `string` \| `number` \| `boolean`\>\>

---

### deliveryEvents

> `readonly` **deliveryEvents**: readonly [`EngagementDeliveryEventSummary`](/api/admin-core/src/type-aliases/engagementdeliveryeventsummary/)[]

---

### endpoints

> `readonly` **endpoints**: readonly [`EngagementEndpointSummary`](/api/admin-core/src/type-aliases/engagementendpointsummary/)[]

---

### identitySummary

> `readonly` **identitySummary**: `object`

#### displayName?

> `readonly` `optional` **displayName?**: `string`

#### externalId?

> `readonly` `optional` **externalId?**: `string`

---

### preferences

> `readonly` **preferences**: readonly [`EngagementPreferenceSummary`](/api/admin-core/src/type-aliases/engagementpreferencesummary/)[]

---

### recentSends

> `readonly` **recentSends**: readonly [`EngagementDispatchSummary`](/api/admin-core/src/type-aliases/engagementdispatchsummary/)[]

---

### recipient

> `readonly` **recipient**: [`RecipientRef`](/api/admin-core/src/type-aliases/recipientref/)

---

### suppressions

> `readonly` **suppressions**: readonly [`EngagementSuppressionSummary`](/api/admin-core/src/type-aliases/engagementsuppressionsummary/)[]
