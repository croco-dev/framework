---
editUrl: false
next: false
prev: false
title: "RedisClient"
---

Redis 클라이언트 인터페이스 (ioredis, upstash 등 구현체와 분리)

## Methods

### eval()

> **eval**\<`TResult`\>(`script`, `keys`, `args`): `Promise`\<`TResult`\>

Lua 스크립트 실행

#### Type Parameters

##### TResult

`TResult` _extends_ `unknown`[]

#### Parameters

##### script

`string`

##### keys

`string`[]

##### args

(`string` \| `number`)[]

#### Returns

`Promise`\<`TResult`\>

---

### set()

> **set**(`key`, `value`, `mode`, `expireMode`, `expire`): `Promise`\<`string`\>

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

`Promise`\<`string`\>

---

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

---

### zrangebyscore()

> **zrangebyscore**(`key`, `min`, `max`): `Promise`\<`string`[]\>

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
