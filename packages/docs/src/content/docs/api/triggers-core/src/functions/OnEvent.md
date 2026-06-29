---
editUrl: false
next: false
prev: false
title: "OnEvent"
---

> **OnEvent**(`event`, `options?`): `MethodDecorator`

OnEvent decorator for handling domain events.

Integration with @croco/events-core will be implemented separately.

## Parameters

### event

`string`

### options?

[`EventOptions`](/api/triggers-core/src/type-aliases/eventoptions/) = `{}`

## Returns

`MethodDecorator`

## Example

```ts
class OrderEventHandler {
  &#64;OnEvent('OrderPlaced', { name: 'order-confirmation' })
  async sendConfirmation(event: OrderPlacedEvent) {
    // 주문 확인 이메일 발송
  }

  &#64;OnEvent('PaymentFailed', { concurrency: 5 })
  async handlePaymentFailure(event: PaymentFailedEvent) {
    // 결제 실패 처리
  }
}
```
