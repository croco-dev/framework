---
editUrl: false
next: false
prev: false
title: "NotificationProvider"
---

## Methods

### getCapabilities()

> **getCapabilities**(): [`NotificationProviderCapabilities`](/api/notifications-core/src/type-aliases/notificationprovidercapabilities/)

Provider capability contract used by the dispatch layer.

#### Returns

[`NotificationProviderCapabilities`](/api/notifications-core/src/type-aliases/notificationprovidercapabilities/)

---

### getChannel()

> **getChannel**(): [`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

Get the channel this provider supports

#### Returns

[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

---

### getName()

> **getName**(): `string`

Provider identifier (e.g., 'resend', 'twilio')

#### Returns

`string`

---

### send()

> **send**(`payload`, `options?`): `Promise`\<[`NotificationResult`](/api/notifications-core/src/type-aliases/notificationresult/)\>

Send a notification via this provider

#### Parameters

##### payload

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

##### options?

[`NotificationSendOptions`](/api/notifications-core/src/type-aliases/notificationsendoptions/)

#### Returns

`Promise`\<[`NotificationResult`](/api/notifications-core/src/type-aliases/notificationresult/)\>
