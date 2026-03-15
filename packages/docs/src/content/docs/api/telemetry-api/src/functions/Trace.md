---
editUrl: false
next: false
prev: false
title: "Trace"
---

> **Trace**(`options?`): `MethodDecorator`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:31](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-api/src/libs/decorators/Trace.ts#L31)

Decorator that automatically traces async method execution.

## Parameters

### options?

[`TraceDecoratorOptions`](/api/telemetry-api/src/type-aliases/tracedecoratoroptions/) = `{}`

## Returns

`MethodDecorator`

## Remarks

Wraps the method in an OpenTelemetry Span, recording execution time and errors.
Must be used after SDK initialization via @croco/telemetry-sdk-node.

## Example

```typescript
import { Trace } from '@croco/telemetry-api';

class OrderService {
  @Trace({ name: 'place-order' })
  async placeOrder(dto: CreateOrderDto): Promise<Order> {
    return this.repository.save(dto);
  }
}
```
