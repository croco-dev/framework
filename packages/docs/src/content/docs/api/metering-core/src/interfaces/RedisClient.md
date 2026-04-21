---
editUrl: false
next: false
prev: false
title: "RedisClient"
---

Defined in: [packages/metering-core/src/libs/RedisClient.ts:4](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/RedisClient.ts#L4)

Redis 클라이언트 인터페이스 (ioredis, upstash 등 구현체와 분리)

## Methods

### eval()

> **eval**\<`TResult`\>(`script`, `keys`, `args`): `Promise`\<`TResult`\>

Defined in: [packages/metering-core/src/libs/RedisClient.ts:23](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/RedisClient.ts#L23)

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

Defined in: [packages/metering-core/src/libs/RedisClient.ts:18](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/RedisClient.ts#L18)

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

Defined in: [packages/metering-core/src/libs/RedisClient.ts:8](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/RedisClient.ts#L8)

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

> **zrangebyscore**(`key`, `min`, `max`): `Promise`\<`string`[]\>

Defined in: [packages/metering-core/src/libs/RedisClient.ts:13](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/metering-core/src/libs/RedisClient.ts#L13)

Sorted Set에서 점수 범위로 멤버 조회

#### Parameters

##### key

`string`

##### min

`number`

##### max

`number`

#### Returns

`Promise`\<`string`[]\>
