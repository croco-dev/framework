---
editUrl: false
next: false
prev: false
title: "SqsTaskDispatcherOptions"
---

> **SqsTaskDispatcherOptions** = `object`

## Properties

### client?

> `readonly` `optional` **client?**: [`SqsTaskClient`](/api/tasks-sqs/src/interfaces/sqstaskclient/)

---

### messageGroupId?

> `readonly` `optional` **messageGroupId?**: `string`

---

### queueUrl

> `readonly` **queueUrl**: `string`

---

### region

> `readonly` **region**: `string`

---

### tenantId

> `readonly` **tenantId**: `string`

Server-configured tenant authority. Use a separate dispatcher for each tenant.
