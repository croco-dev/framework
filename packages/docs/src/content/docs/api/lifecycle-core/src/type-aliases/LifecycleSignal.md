---
editUrl: false
next: false
prev: false
title: "LifecycleSignal"
---

> **LifecycleSignal** = `object`

## Properties

### data?

> `readonly` `optional` **data?**: `Record`\<`string`, `unknown`\>

---

### id?

> `readonly` `optional` **id?**: `string`

Stable source event identity issued once at the durable ingress boundary and
preserved on every redelivery envelope. Required for default source dedupe;
the evaluator rejects missing identity instead of estimating it from
timestamps, payloads, or per-attempt UUIDs.

---

### occurredAt

> `readonly` **occurredAt**: `Date`

---

### source?

> `readonly` `optional` **source?**: `string`

Provider/source namespace that disambiguates identical event IDs issued by
different sources. Combined with the event id as the dedupe tuple.

---

### tenantId

> `readonly` **tenantId**: `string`

---

### type

> `readonly` **type**: [`LifecycleSignalType`](/api/lifecycle-core/src/type-aliases/lifecyclesignaltype/)
