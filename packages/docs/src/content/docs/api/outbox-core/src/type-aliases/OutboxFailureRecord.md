---
editUrl: false
next: false
prev: false
title: "OutboxFailureRecord"
---

> **OutboxFailureRecord** = `object`

Persisted failure state containing Problem.toJSON() output and normalized retry metadata.

## Properties

### problem

> `readonly` **problem**: `ReturnType`\<[`Problem`](/api/problems-core/src/classes/problem/)\[`"toJSON"`\]\>

---

### retry

> `readonly` **retry**: [`OutboxFailureMetadata`](/api/outbox-core/src/type-aliases/outboxfailuremetadata/)
