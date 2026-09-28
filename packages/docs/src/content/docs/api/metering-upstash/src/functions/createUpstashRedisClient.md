---
editUrl: false
next: false
prev: false
title: "createUpstashRedisClient"
---

> **createUpstashRedisClient**(`redis`): [`UpstashRedisClient`](/api/metering-upstash/src/classes/upstashredisclient/)

Upstash Redis 인스턴스를 어댑터로 감싸는 헬퍼 함수입니다.
`automaticDeserialization: false`로 생성한 인스턴스가 필요합니다.
EVAL 응답의 객체는 설정 Problem으로 감지하지만 숫자로 역직렬화된 문자열은 감지할 수 없습니다.

## Parameters

### redis

`Redis`

## Returns

[`UpstashRedisClient`](/api/metering-upstash/src/classes/upstashredisclient/)
