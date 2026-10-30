---
editUrl: false
next: false
prev: false
title: "OutboxRetryOptions"
---

> **OutboxRetryOptions** = `object`

## Properties

### maxAttempts?

> `readonly` `optional` **maxAttempts?**: `number`

Positive safe integer. Defaults to 3; invalid budgets reject before any record or idempotency mutation.
