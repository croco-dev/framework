---
editUrl: false
next: false
prev: false
title: "UpstashRedisMeteringClient"
---

> **UpstashRedisMeteringClient** = `object`

## Methods

### eval()

> **eval**\<`TResult`\>(`script`, `keys`, `args`): `Promise`\<`TResult`\>

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
