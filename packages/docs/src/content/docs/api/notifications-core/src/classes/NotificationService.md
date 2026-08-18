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

### registerPreferenceRule()

> **registerPreferenceRule**(`rule`): `void`

#### Parameters

##### rule

[`NotificationPreferenceRule`](/api/notifications-core/src/type-aliases/notificationpreferencerule/)

#### Returns

`void`

***

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

### registerTemplate()

> **registerTemplate**(`template`): `void`

#### Parameters

##### template

[`NotificationTemplate`](/api/notifications-core/src/type-aliases/notificationtemplate/)

#### Returns

`void`

***

### renderTemplate()

> **renderTemplate**(`request`): [`NotificationTemplateRenderResult`](/api/notifications-core/src/type-aliases/notificationtemplaterenderresult/)

#### Parameters

##### request

[`NotificationTemplateRenderRequest`](/api/notifications-core/src/type-aliases/notificationtemplaterenderrequest/)

#### Returns

[`NotificationTemplateRenderResult`](/api/notifications-core/src/type-aliases/notificationtemplaterenderresult/)

***

### send()

> **send**(`channel`, `payload`, `options`): `Promise`\<`void`\>

Send a notification via task execution.

This method waits for the configured TaskRunner to execute the
`send-notification` task, so task and provider failures are propagated
back to the caller.

#### Parameters

##### channel

[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

##### payload

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

##### options

[`NotificationSendServiceOptions`](/api/notifications-core/src/type-aliases/notificationsendserviceoptions/)

#### Returns

`Promise`\<`void`\>

***

### sendTemplate()

> **sendTemplate**(`channel`, `request`, `options`): `Promise`\<`void`\>

#### Parameters

##### channel

[`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

##### request

[`NotificationTemplateSendRequest`](/api/notifications-core/src/type-aliases/notificationtemplatesendrequest/)

##### options

[`NotificationSendServiceOptions`](/api/notifications-core/src/type-aliases/notificationsendserviceoptions/)

#### Returns

`Promise`\<`void`\>
