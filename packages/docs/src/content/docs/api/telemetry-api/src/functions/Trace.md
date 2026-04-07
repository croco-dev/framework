---
editUrl: false
next: false
prev: false
title: "Trace"
---

> **Trace**\<`Args`, `ReturnType`\>(`options?`): (`_target`, `propertyKey`, `descriptor`) => `TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`

Defined in: [packages/telemetry-api/src/libs/decorators/Trace.ts:31](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-api/src/libs/decorators/Trace.ts#L31)

Decorator that automatically traces async method execution.

## Type Parameters

### Args

`Args` *extends* `unknown`[] = `unknown`[]

### ReturnType

`ReturnType` = `unknown`

## Parameters

### options?

[`TraceDecoratorOptions`](/api/telemetry-api/src/type-aliases/tracedecoratoroptions/) = `{}`

## Returns

> (`_target`, `propertyKey`, `descriptor`): `TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`

### Parameters

#### \_target

`object`

#### propertyKey

`string` | `symbol`

#### descriptor

`TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\>

### Returns

`TypedPropertyDescriptor`\<(...`args`) => `Promise`\<`ReturnType`\>\> \| `undefined`

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
