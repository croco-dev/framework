---
editUrl: false
next: false
prev: false
title: "OutboxFailureRecord"
---

> **OutboxFailureRecord** = `object`

Provider-neutral transactional outbox storage contract.

## Properties

### problem

> `readonly` **problem**: `ReturnType`\<[`Problem`](/api/problems-core/src/classes/problem/)\[`"toJSON"`\]\>

***

### retry

> `readonly` **retry**: [`OutboxFailureMetadata`](/api/outbox-core/src/type-aliases/outboxfailuremetadata/)
