---
editUrl: false
next: false
prev: false
title: "Counter"
---

Counter is a synchronous instrument that records additive values.
Counters are typically used to count occurrences of an event.

## Example

```typescript
const counter = metrics.createCounter({ name: "requests.count" });
counter.add(1, { method: "GET" });
```

## Methods

### add()

> **add**(`value`, `attributes?`, `context?`): `void`

Adds the given value to the current value.
Values are always non-negative.

#### Parameters

##### value

`number`

The value to add (must be non-negative)

##### attributes?

`Attributes`

Optional attributes to associate with this measurement

##### context?

`Context`

Optional context for the measurement

#### Returns

`void`
