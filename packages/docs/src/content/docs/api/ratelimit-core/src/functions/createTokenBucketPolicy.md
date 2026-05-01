---
editUrl: false
next: false
prev: false
title: "createTokenBucketPolicy"
---

> **createTokenBucketPolicy**(`name`, `capacity`, `refillRate`, `refillIntervalMs?`): [`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)

레이트 리밋 정책 생성 함수와 핵심 RateLimiter 클래스입니다.

## Parameters

### name

`string`

### capacity

`number`

### refillRate

`number`

### refillIntervalMs?

`number` = `1000`

## Returns

[`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/)
