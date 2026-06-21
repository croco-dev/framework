---
editUrl: false
next: false
prev: false
title: "UpstashRedisClient"
---

`@upstash/redis`를 `@croco/metering-core`의 RedisClient로 감싸는 어댑터입니다.

## Implements

- [`RedisClient`](/api/metering-core/src/interfaces/redisclient/)

## Constructors

### Constructor

> **new UpstashRedisClient**(`redis`): `UpstashRedisClient`

#### Parameters

##### redis

`Redis`

#### Returns

`UpstashRedisClient`

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

#### Implementation of

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/).[`eval`](/api/metering-core/src/interfaces/redisclient/#eval)

***

### set()

> **set**(`key`, `value`, `_mode`, `_expireMode`, `expire`): `Promise`\<`string` \| `null`\>

키 설정 (NX: 존재하지 않을 때만, EX: TTL)

#### Parameters

##### key

`string`

##### value

`string`

##### \_mode

`"NX"`

##### \_expireMode

`"EX"`

##### expire

`number`

#### Returns

`Promise`\<`string` \| `null`\>

#### Implementation of

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/).[`set`](/api/metering-core/src/interfaces/redisclient/#set)

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

#### Implementation of

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/).[`zadd`](/api/metering-core/src/interfaces/redisclient/#zadd)

***

### zrangebyscore()

> **zrangebyscore**(`key`, `min`, `max`, `withScores?`): `Promise`\<`string`[]\>

Sorted Set에서 점수 범위로 멤버 조회

#### Parameters

##### key

`string`

##### min

`number`

##### max

`number`

##### withScores?

`"WITHSCORES"`

#### Returns

`Promise`\<`string`[]\>

#### Implementation of

[`RedisClient`](/api/metering-core/src/interfaces/redisclient/).[`zrangebyscore`](/api/metering-core/src/interfaces/redisclient/#zrangebyscore)
