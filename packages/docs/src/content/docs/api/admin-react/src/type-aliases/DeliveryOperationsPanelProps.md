---
editUrl: false
next: false
prev: false
title: "DeliveryOperationsPanelProps"
---

> **DeliveryOperationsPanelProps** = `object`

## Properties

### deliveryEvents

> `readonly` **deliveryEvents**: readonly [`EngagementDeliveryEventSummary`](/api/admin-core/src/type-aliases/engagementdeliveryeventsummary/)[]

---

### dispatches

> `readonly` **dispatches**: readonly [`EngagementDispatchSummary`](/api/admin-core/src/type-aliases/engagementdispatchsummary/)[]

---

### filter?

> `readonly` `optional` **filter?**: [`EngagementDeliveryFilter`](/api/admin-core/src/type-aliases/engagementdeliveryfilter/)

---

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### onFilterChange?

> `readonly` `optional` **onFilterChange?**: (`filter`) => `void`

#### Parameters

##### filter

[`EngagementDeliveryFilter`](/api/admin-core/src/type-aliases/engagementdeliveryfilter/)

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
