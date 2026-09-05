---
editUrl: false
next: false
prev: false
title: "Customer360CommunicationPanelProps"
---

> **Customer360CommunicationPanelProps** = `object`

## Properties

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

---

### onCreateSuppression?

> `readonly` `optional` **onCreateSuppression?**: (`request`) => `void`

#### Parameters

##### request

[`EngagementCreateSuppressionRequest`](/api/admin-core/src/type-aliases/engagementcreatesuppressionrequest/)

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

### onSelectRecipient?

> `readonly` `optional` **onSelectRecipient?**: (`recipientId`) => `void`

#### Parameters

##### recipientId

`string`

#### Returns

`void`

---

### selectedRecipientId?

> `readonly` `optional` **selectedRecipientId?**: `string`

---

### state?

> `readonly` `optional` **state?**: [`Customer360CommunicationState`](/api/admin-core/src/type-aliases/customer360communicationstate/)

---

### tenantId

> `readonly` **tenantId**: `string`
