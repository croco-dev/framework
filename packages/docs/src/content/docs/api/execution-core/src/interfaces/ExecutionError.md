---
editUrl: false
next: false
prev: false
title: "ExecutionError"
---

Error details for failed executions.

## Properties

### code?

> `optional` **code?**: `string`

Optional error code for categorization

---

### indeterminate?

> `optional` **indeterminate?**: `boolean`

Whether external effects remain unresolved, regardless of execution status. Clear after confirmed
settlement, a safe retry contract, or operator recovery; handler settlement is not receipt evidence.

---

### message

> **message**: `string`

Error message

---

### retryable

> **retryable**: `boolean`

Whether this error is retryable

---

### stack?

> `optional` **stack?**: `string`

Stack trace for debugging
