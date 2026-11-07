---
editUrl: false
next: false
prev: false
title: "EventBusActiveReplay"
---

> **EventBusActiveReplay** = `object`

An admitted dead-letter batch, including storage operations outside handler execution slots.

## Properties

### phase

> `readonly` **phase**: `"dequeue"` \| `"replay"` \| `"requeue"`

---

### replayId

> `readonly` **replayId**: `string`

Identity local to the owning EventBus instance.

---

### startTime

> `readonly` **startTime**: `number`

Unix timestamp in milliseconds captured before dequeue starts.
