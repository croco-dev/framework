---
editUrl: false
next: false
prev: false
title: "createSqsTaskHandler"
---

> **createSqsTaskHandler**(`options`): (`event`) => `Promise`\<[`SqsTaskBatchResponse`](/api/tasks-sqs/src/type-aliases/sqstaskbatchresponse/)\>

Lambda-only consumer. Poison and terminal messages remain failed for native SQS redrive/DLQ.

## Parameters

### options

[`SqsTaskHandlerOptions`](/api/tasks-sqs/src/type-aliases/sqstaskhandleroptions/)

## Returns

(`event`) => `Promise`\<[`SqsTaskBatchResponse`](/api/tasks-sqs/src/type-aliases/sqstaskbatchresponse/)\>
