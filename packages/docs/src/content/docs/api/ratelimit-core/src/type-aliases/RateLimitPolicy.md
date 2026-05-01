---
editUrl: false
next: false
prev: false
title: "RateLimitPolicy"
---

> **RateLimitPolicy** = [`FixedWindowPolicy`](/api/ratelimit-core/src/type-aliases/fixedwindowpolicy/) \| [`SlidingWindowPolicy`](/api/ratelimit-core/src/type-aliases/slidingwindowpolicy/) \| [`TokenBucketPolicy`](/api/ratelimit-core/src/type-aliases/tokenbucketpolicy/) \| \{ `algorithm?`: [`RateLimitAlgorithm`](/api/ratelimit-core/src/type-aliases/ratelimitalgorithm/); `limit`: `number`; `name`: `string`; `windowMs`: `number`; \}

정책, 결과, 통계, 타입 가드에 사용하는 핵심 타입과 유틸리티입니다.
