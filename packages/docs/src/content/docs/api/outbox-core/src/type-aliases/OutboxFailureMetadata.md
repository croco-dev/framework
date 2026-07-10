---
editUrl: false
next: false
prev: false
title: "OutboxFailureMetadata"
---

> **OutboxFailureMetadata** = `object`

Retry and terminal-state metadata attached to a dispatch failure Problem.

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
