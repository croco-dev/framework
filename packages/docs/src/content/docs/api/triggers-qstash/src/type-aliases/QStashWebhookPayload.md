---
editUrl: false
next: false
prev: false
title: "QStashWebhookPayload"
---

> **QStashWebhookPayload** = `object`

Webhook request payload from QStash.

## Properties

### className?

> `readonly` `optional` **className?**: `string`

Target class name to execute.

---

### cronExpression

> `readonly` **cronExpression**: `string`

Cron expression for this schedule.

---

### methodName

> `readonly` **methodName**: `string`

Target method name to execute.

---

### options?

> `readonly` `optional` **options?**: `object`

Additional options from the

#### description?

> `readonly` `optional` **description?**: `string`

#### enabled?

> `readonly` `optional` **enabled?**: `boolean`

#### name?

> `readonly` `optional` **name?**: `string`

#### timezone?

> `readonly` `optional` **timezone?**: `string`

#### Cron

decorator.

---

### scheduleId

> `readonly` **scheduleId**: `string`

Schedule ID that triggered this webhook.

---

### timestamp

> `readonly` **timestamp**: `string`

Timestamp when the webhook was triggered.

---

### triggerName?

> `readonly` `optional` **triggerName?**: `string`
