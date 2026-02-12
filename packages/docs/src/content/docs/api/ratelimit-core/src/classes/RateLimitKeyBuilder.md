---
editUrl: false
next: false
prev: false
title: "RateLimitKeyBuilder"
---

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:19](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L19)

Builds rate limit keys from context using configurable segments.

## Example

```ts
const builder = new RateLimitKeyBuilder(['tenant', 'user', 'route']);
const key = builder.build(context, 'api-default');
// Result: "rl:api-default:tenant_123:user_456::GET:/api/users"
```

## Constructors

### Constructor

> **new RateLimitKeyBuilder**(`segments`): `RateLimitKeyBuilder`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:22](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L22)

#### Parameters

##### segments

[`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

#### Returns

`RateLimitKeyBuilder`

## Methods

### build()

> **build**(`context`, `policyName`): `string`

Defined in: [packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts:35](https://github.com/croco-dev/shared/blob/6c740cec42c19b94e53a518f632803f284903537/packages/ratelimit-core/src/libs/RateLimitKeyBuilder.ts#L35)

Build a rate limit key from context.

#### Parameters

##### context

[`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

Context containing segment values

##### policyName

`string`

Policy identifier

#### Returns

`string`

Composite key string
