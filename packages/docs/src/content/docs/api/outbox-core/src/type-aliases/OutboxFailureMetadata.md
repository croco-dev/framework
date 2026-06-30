---
editUrl: false
next: false
prev: false
title: "OutboxFailureMetadata"
---

> **OutboxFailureMetadata** = `object`

Provider-neutral transactional outbox storage contract.

## Properties

### attempt

> `readonly` **attempt**: `number`

***

### failedAt

> `readonly` **failedAt**: `Date`

***

### maxAttempts

> `readonly` **maxAttempts**: `number`

***

### nextVisibleAt?

> `readonly` `optional` **nextVisibleAt?**: `Date`

***

### retryable

> `readonly` **retryable**: `boolean`

***

### terminal

> `readonly` **terminal**: `boolean`
