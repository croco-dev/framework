---
editUrl: false
next: false
prev: false
title: "WebhookReliabilityConsoleProps"
---

> **WebhookReliabilityConsoleProps** = `object`

## Properties

### filter?

> `readonly` `optional` **filter?**: [`WebhookDeliveryOperationsFilter`](/api/admin-core/src/type-aliases/webhookdeliveryoperationsfilter/)

---

### onAcknowledgeSecret?

> `readonly` `optional` **onAcknowledgeSecret?**: () => `void`

#### Returns

`void`

---

### onAction?

> `readonly` `optional` **onAction?**: (`action`) => `void`

#### Parameters

##### action

[`WebhookOperationsAction`](/api/admin-core/src/type-aliases/webhookoperationsaction/)

#### Returns

`void`

---

### onSelectDelivery?

> `readonly` `optional` **onSelectDelivery?**: (`deliveryId`) => `void`

#### Parameters

##### deliveryId

`string`

#### Returns

`void`

---

### onSelectEndpoint?

> `readonly` `optional` **onSelectEndpoint?**: (`endpointId`) => `void`

#### Parameters

##### endpointId

`string`

#### Returns

`void`

---

### selectedDeliveryId?

> `readonly` `optional` **selectedDeliveryId?**: `string`

---

### selectedEndpointId?

> `readonly` `optional` **selectedEndpointId?**: `string`

---

### state

> `readonly` **state**: [`WebhookOperationsState`](/api/admin-core/src/type-aliases/webhookoperationsstate/)
