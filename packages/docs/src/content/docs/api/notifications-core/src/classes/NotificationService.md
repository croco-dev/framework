---
editUrl: false
next: false
prev: false
title: "NotificationService"
---

## Constructors

### Constructor

> **new NotificationService**(`taskRunner`, `registry`): `NotificationService`

#### Parameters

##### taskRunner

[`TaskRunner`](/api/tasks-core/src/classes/taskrunner/)

##### registry

`NotificationProviderRegistry`

#### Returns

`NotificationService`

## Methods

### registerProvider()

> **registerProvider**(`provider`, `isDefault?`): `void`

#### Parameters

##### provider

[`NotificationProvider`](/api/notifications-core/src/interfaces/notificationprovider/)

##### isDefault?

`boolean` = `false`

#### Returns

`void`

***

### send()

> **send**(`channel`, `payload`, `options?`): `Promise`\<`void`\>

Send a notification via task execution.

This method waits for the configured TaskRunner to execute the
`send-notification` task, so task and provider failures are propagated
back to the caller.

#### Parameters

##### channel

[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

##### payload

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

##### options?

`string` \| `NotificationSendServiceOptions`

#### Returns

`Promise`\<`void`\>
