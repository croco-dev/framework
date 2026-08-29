---
editUrl: false
next: false
prev: false
title: "NotificationJobPayload"
---

## Extends

- [`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

## Properties

### content

> **content**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`content`](/api/notifications-core/src/interfaces/notificationpayload/#content)

---

### dispatchContext?

> `optional` **dispatchContext?**: `object`

#### channel

> **channel**: [`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

#### preferenceDecision?

> `optional` **preferenceDecision?**: `object`

##### preferenceDecision.allowed

> **allowed**: `boolean`

##### preferenceDecision.context

> **context**: `object`

##### preferenceDecision.context.channel

> **channel**: [`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

##### preferenceDecision.context.tenantId

> **tenantId**: `string`

##### preferenceDecision.context.topic

> **topic**: `string`

##### preferenceDecision.context.userId

> **userId**: `string`

##### preferenceDecision.evaluationKey

> **evaluationKey**: `string`

##### preferenceDecision.reason

> **reason**: `string`

##### preferenceDecision.ruleId?

> `optional` **ruleId?**: `string`

#### providerCapabilities

> **providerCapabilities**: [`NotificationProviderCapabilities`](/api/notifications-core/src/type-aliases/notificationprovidercapabilities/)

#### template?

> `optional` **template?**: `object`

##### template.id

> **id**: `string`

##### template.locale

> **locale**: `string`

##### template.version

> **version**: `string`

---

### headers?

> `optional` **headers?**: `Readonly`\<`Record`\<`string`, `string`\>\>

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`headers`](/api/notifications-core/src/interfaces/notificationpayload/#headers)

---

### idempotencyKey?

> `optional` **idempotencyKey?**: `string`

---

### locale?

> `optional` **locale?**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`locale`](/api/notifications-core/src/interfaces/notificationpayload/#locale)

---

### metadata?

> `optional` **metadata?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`metadata`](/api/notifications-core/src/interfaces/notificationpayload/#metadata)

---

### outbox?

> `optional` **outbox?**: `object`

#### idempotencyKey

> **idempotencyKey**: `string`

#### outboxMessageId?

> `optional` **outboxMessageId?**: `string`

---

### providerName

> **providerName**: `string`

---

### subject?

> `optional` **subject?**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`subject`](/api/notifications-core/src/interfaces/notificationpayload/#subject)

---

### templateId?

> `optional` **templateId?**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`templateId`](/api/notifications-core/src/interfaces/notificationpayload/#templateid)

---

### templateVersion?

> `optional` **templateVersion?**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`templateVersion`](/api/notifications-core/src/interfaces/notificationpayload/#templateversion)

---

### to

> **to**: `string`

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`to`](/api/notifications-core/src/interfaces/notificationpayload/#to)

---

### variables?

> `optional` **variables?**: `Record`\<`string`, `unknown`\>

#### Inherited from

[`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/).[`variables`](/api/notifications-core/src/interfaces/notificationpayload/#variables)
