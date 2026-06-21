---
editUrl: false
next: false
prev: false
title: "HandleResult"
---

> **HandleResult** = `object`

Result of handling a QStash webhook.

## Properties

### body

> `readonly` **body**: `unknown`

Response body.

***

### error?

> `readonly` `optional` **error**: `string`

Error message if handling failed.

***

### executionId?

> `readonly` `optional` **executionId**: `string`

Execution ID if an execution was created.

***

### statusCode

> `readonly` **statusCode**: `number`

HTTP status code to return.

***

### success

> `readonly` **success**: `boolean`

Whether the webhook was handled successfully.
