---
editUrl: false
next: false
prev: false
title: "NotificationDispatchRequest"
---

> **NotificationDispatchRequest** = `object`

## Properties

### channel

> `readonly` **channel**: [`NotificationChannel`](/api/notifications-core/src/enumerations/notificationchannel/)

---

### idempotencyKey?

> `readonly` `optional` **idempotencyKey?**: `string`

---

### outbox?

> `readonly` `optional` **outbox?**: [`NotificationOutboxReference`](/api/notifications-core/src/type-aliases/notificationoutboxreference/)

---

### payload

> `readonly` **payload**: [`NotificationPayload`](/api/notifications-core/src/interfaces/notificationpayload/)

---

### preferenceDecision?

> `readonly` `optional` **preferenceDecision?**: [`NotificationPreferenceDecision`](/api/notifications-core/src/type-aliases/notificationpreferencedecision/)

---

### providerCapabilities

> `readonly` **providerCapabilities**: [`NotificationProviderCapabilities`](/api/notifications-core/src/type-aliases/notificationprovidercapabilities/)

---

### providerName

> `readonly` **providerName**: `string`

---

### template?

> `readonly` `optional` **template?**: [`NotificationTemplateRef`](/api/notifications-core/src/type-aliases/notificationtemplateref/)
