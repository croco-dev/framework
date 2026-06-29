---
editUrl: false
next: false
prev: false
title: "ResendProvider"
---

Resend를 사용해 이메일 알림을 전송하는 NotificationProvider 구현체입니다.

## Implements

- [`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/)

## Constructors

### Constructor

> **new ResendProvider**(`config`): `ResendProvider`

#### Parameters

##### config

[`ResendConfig`](/api/notifications-resend/src/interfaces/resendconfig/)

#### Returns

`ResendProvider`

## Methods

### getChannel()

> **getChannel**(): [`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

Get the channel this provider supports

#### Returns

[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

#### Implementation of

[`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/).[`getChannel`](/api/notifications-core/src/interfaces/notificationprovider/#getchannel)

***

### getName()

> **getName**(): `string`

Provider identifier (e.g., 'resend', 'twilio')

#### Returns

`string`

#### Implementation of

[`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/).[`getName`](/api/notifications-core/src/interfaces/notificationprovider/#getname)

***

### send()

> **send**(`payload`, `options?`): `Promise`\<[`NotificationResult`](/api/notifications-core/src/interfaces/notificationresult/)\>

Send a notification via this provider

#### Parameters

##### payload

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

##### options?

[`NotificationSendOptions`](/api/notifications-core/src/type-aliases/notificationsendoptions/)

#### Returns

`Promise`\<[`NotificationResult`](/api/notifications-core/src/interfaces/notificationresult/)\>

#### Implementation of

[`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/).[`send`](/api/notifications-core/src/interfaces/notificationprovider/#send)

***

### sendBatch()

> **sendBatch**(`payloads`): `Promise`\<[`NotificationResult`](/api/notifications-core/src/interfaces/notificationresult/)[]\>

#### Parameters

##### payloads

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)[]

#### Returns

`Promise`\<[`NotificationResult`](/api/notifications-core/src/interfaces/notificationresult/)[]\>
