---
editUrl: false
next: false
prev: false
title: "OnEvent"
---

Event trigger metadata key and decorator.

## Call Signature

> **OnEvent**\<`Ref`\>(`event`, `options?`): `TypedTriggerMethodDecorator`\<`TriggerRefInput`\<`Ref`\>, `TriggerRefResult`\<`Ref`\>\>

OnEvent decorator for handling domain events.

Pass a typed reference from `defineEventTrigger` to verify the handler payload and result at
compile time. String event names remain available for compatibility.

### Type Parameters

#### Ref

`Ref` _extends_ `AnyEventTriggerRef`

### Parameters

#### event

`Ref`

#### options?

[`EventOptions`](/api/triggers-core/src/type-aliases/eventoptions/)

### Returns

`TypedTriggerMethodDecorator`\<`TriggerRefInput`\<`Ref`\>, `TriggerRefResult`\<`Ref`\>\>

### Example

```ts
const orderPlaced = defineEventTrigger<OrderPlacedEvent>()('OrderPlaced');

class OrderEventHandler {
  &#64;OnEvent(orderPlaced, { name: 'order-confirmation' })
  async sendConfirmation(event: OrderPlacedEvent) {
    // 주문 확인 이메일 발송
  }

  &#64;OnEvent('PaymentFailed', { concurrency: 5 })
  async handlePaymentFailure(event: PaymentFailedEvent) {
    // 결제 실패 처리
  }
}
```

## Call Signature

> **OnEvent**(`event`, `options?`): `MethodDecorator`

OnEvent decorator for handling domain events.

Pass a typed reference from `defineEventTrigger` to verify the handler payload and result at
compile time. String event names remain available for compatibility.

### Parameters

#### event

`string`

#### options?

[`EventOptions`](/api/triggers-core/src/type-aliases/eventoptions/)

### Returns

`MethodDecorator`

### Example

```ts
const orderPlaced = defineEventTrigger<OrderPlacedEvent>()('OrderPlaced');

class OrderEventHandler {
  &#64;OnEvent(orderPlaced, { name: 'order-confirmation' })
  async sendConfirmation(event: OrderPlacedEvent) {
    // 주문 확인 이메일 발송
  }

  &#64;OnEvent('PaymentFailed', { concurrency: 5 })
  async handlePaymentFailure(event: PaymentFailedEvent) {
    // 결제 실패 처리
  }
}
```
