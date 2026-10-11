---
editUrl: false
next: false
prev: false
title: "ensureDurableLifecycleSignal"
---

> **ensureDurableLifecycleSignal**(`input`): [`DurableLifecycleSignal`](/api/lifecycle-core/src/type-aliases/durablelifecyclesignal/)

Durable ingress helper: issues a stable source event id exactly once when the
source did not supply one, and preserves an existing id on redelivery. The id
belongs on the retryable envelope/outbox record, not inside the evaluator.

## Parameters

### input

[`DurableLifecycleEnvelopeInput`](/api/lifecycle-core/src/type-aliases/durablelifecycleenvelopeinput/)

## Returns

[`DurableLifecycleSignal`](/api/lifecycle-core/src/type-aliases/durablelifecyclesignal/)
