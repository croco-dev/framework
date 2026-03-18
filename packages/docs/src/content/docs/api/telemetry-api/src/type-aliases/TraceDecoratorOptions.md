---
editUrl: false
next: false
prev: false
title: "TraceDecoratorOptions"
---

> **TraceDecoratorOptions** = `object`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:4](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/decorators/Trace.ts#L4)

Options for configuring the

## Trace

decorator behavior.

## Remarks

Allows customization of the Span name and additional attributes.

## Example

```typescript
class PaymentService {
  @Trace({
    name: 'process-payment',
    attributes: { 'service.type': 'payment' }
  })
  async processPayment(amount: number): Promise<void> {
    // ...
  }
}
```

## Properties

### attributes?

> `optional` **attributes**: `Attributes`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:6](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/decorators/Trace.ts#L6)

Additional key-value pairs to attach to the Span

***

### name?

> `optional` **name**: `string`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:5](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-api/src/libs/decorators/Trace.ts#L5)

Custom Span name (defaults to method name)
