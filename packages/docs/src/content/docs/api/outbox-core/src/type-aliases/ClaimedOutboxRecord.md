---
editUrl: false
next: false
prev: false
title: "ClaimedOutboxRecord"
---

> **ClaimedOutboxRecord** = [`OutboxRecord`](/api/outbox-core/src/type-aliases/outboxrecord/) & `object`

Provider-neutral transactional outbox storage contract.

## Type Declaration

### claim

> `readonly` **claim**: [`OutboxClaim`](/api/outbox-core/src/type-aliases/outboxclaim/)

### status

> `readonly` **status**: `"claimed"`
