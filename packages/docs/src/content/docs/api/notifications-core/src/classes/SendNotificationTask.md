---
editUrl: false
next: false
prev: false
title: "SendNotificationTask"
---

## Constructors

### Constructor

> **new SendNotificationTask**(`registry`): `SendNotificationTask`

#### Parameters

##### registry

`NotificationProviderRegistry`

#### Returns

`SendNotificationTask`

## Methods

### handle()

> **handle**(`payload`): `Promise`\<`void`\>

#### Parameters

##### payload

[`NotificationJobPayload`](/api/notifications-core/src/interfaces/notificationjobpayload/)

#### Returns

`Promise`\<`void`\>

***

### registerProvider()

> **registerProvider**(`provider`): `void`

#### Parameters

##### provider

[`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/)

#### Returns

`void`
