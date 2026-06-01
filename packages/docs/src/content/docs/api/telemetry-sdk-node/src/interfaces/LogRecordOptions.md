---
editUrl: false
next: false
prev: false
title: "LogRecordOptions"
---

Options for emitting a log record.

## Properties

### attributes?

> `optional` **attributes**: `Attributes`

Additional attributes

***

### body

> **body**: `string` \| `Record`\<`string`, `unknown`\>

The log message body (string or structured object)

***

### context?

> `optional` **context**: `Context`

Context for trace correlation

***

### severity

> **severity**: [`LogSeverity`](/api/telemetry-sdk-node/src/enumerations/logseverity/)

Severity level
