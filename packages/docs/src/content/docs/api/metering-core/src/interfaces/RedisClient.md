---
editUrl: false
next: false
prev: false
title: "RedisClient"
---

Redis 클라이언트 인터페이스 (ioredis, upstash 등 구현체와 분리)

## Properties

### scriptKeyAccess

> `readonly` **scriptKeyAccess**: `"multi-key"`

Metering의 원자적 스크립트는 여러 키에 접근하므로 단일 노드/단일 슬롯 실행 모델이 필요합니다.
Redis Cluster처럼 서로 다른 슬롯의 키 접근을 거부하는 클라이언트는 지원하지 않습니다.

## Methods

### eval()

> **eval**\<`TResult`\>(`script`, `keys`, `args`): `Promise`\<`TResult`\>

Lua 스크립트 실행

#### Type Parameters

##### TResult

`TResult` *extends* `unknown`[]

#### Parameters

##### script

`string`

##### keys

`string`[]

##### args

(`string` \| `number`)[]

#### Returns

`Promise`\<`TResult`\>

***

### set()

> **set**(`key`, `value`, `mode`, `expireMode`, `expire`): `Promise`\<`string` \| `null`\>

키 설정 (NX: 존재하지 않을 때만, EX: TTL)

#### Parameters

##### key

`string`

##### value

`string`

##### mode

`"NX"`

##### expireMode

`"EX"`

##### expire

`number`

#### Returns

`Promise`\<`string` \| `null`\>

***

### zadd()

> **zadd**(`key`, `score`, `member`): `Promise`\<`number`\>

Sorted Set에 멤버 추가

#### Parameters

##### key

`string`

##### score

`number`

##### member

`string`

#### Returns

`Promise`\<`number`\>

***

### zrangebyscore()

#### Call Signature

> **zrangebyscore**(`key`, `min`, `max`): `Promise`\<`string`[]\>

Sorted Set에서 점수 범위로 멤버 조회

##### Parameters

###### key

`string`

###### min

`number`

###### max

`number`

##### Returns

`Promise`\<`string`[]\>

#### Call Signature

> **zrangebyscore**(`key`, `min`, `max`, `withScores`): `Promise`\<`string`[]\>

##### Parameters

###### key

`string`

###### min

`number`

###### max

`number`

###### withScores

`"WITHSCORES"`

##### Returns

`Promise`\<`string`[]\>
