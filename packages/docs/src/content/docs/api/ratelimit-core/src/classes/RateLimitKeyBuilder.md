---
editUrl: false
next: false
prev: false
title: "RateLimitKeyBuilder"
---

레이트 리밋 키 구성에 사용하는 타입과 키 빌더입니다.

## Constructors

### Constructor

> **new RateLimitKeyBuilder**(`segments`): `RateLimitKeyBuilder`

#### Parameters

##### segments

[`KeySegment`](/api/ratelimit-core/src/type-aliases/keysegment/)[]

#### Returns

`RateLimitKeyBuilder`

## Methods

### build()

> **build**(`context`, `policyName`): `string`

#### Parameters

##### context

[`KeyContext`](/api/ratelimit-core/src/type-aliases/keycontext/)

##### policyName

`string`

#### Returns

`string`
