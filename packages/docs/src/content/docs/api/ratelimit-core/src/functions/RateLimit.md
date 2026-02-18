---
editUrl: false
next: false
prev: false
title: "RateLimit"
---

> **RateLimit**(`options?`): `MethodDecorator`

Defined in: [packages/ratelimit-core/src/libs/decorators/RateLimit.ts:38](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/ratelimit-core/src/libs/decorators/RateLimit.ts#L38)

Method decorator that applies rate limiting to an endpoint.
Automatically registers RateLimitGuard - no need for @UseGuards(RateLimitGuard).

## Parameters

### options?

[`RateLimitDecoratorOptions`](/api/ratelimit-core/src/type-aliases/ratelimitdecoratoroptions/) = `{}`

## Returns

`MethodDecorator`

## Examples

```typescript
@RateLimit({ limit: 10, window: '1m' })
@Get('/expensive')
async expensiveOperation() {}
```

```typescript
// Dynamic limit based on context
@RateLimit({
  limit: 100,
  window: '1h',
  key: (ctx) => ctx.get('tenant')?.id
})
@Post('/api')
async apiCall() {}
```
