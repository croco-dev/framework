---
editUrl: false
next: false
prev: false
title: "DrizzleAccessProvider"
---

관계 튜플 테이블을 사용하는 AccessProvider 구현체입니다.

## Implements

- `AccessProvider`

## Constructors

### Constructor

> **new DrizzleAccessProvider**(`db`): `DrizzleAccessProvider`

Drizzle 실행 클라이언트를 주입해 접근 제어 저장소를 초기화합니다.

#### Parameters

##### db

`DrizzleDb`

#### Returns

`DrizzleAccessProvider`

## Methods

### check()

> **check**(`request`): `Promise`\<`CheckResult`\>

요청한 관계가 직접 또는 재귀 관계를 통해 허용되는지 확인합니다.

#### Parameters

##### request

`CheckRequest`

#### Returns

`Promise`\<`CheckResult`\>

#### Implementation of

`AccessProvider.check`

***

### grant()

> **grant**(`request`): `Promise`\<`void`\>

관계 튜플을 추가합니다. 중복 튜플은 무시합니다.

#### Parameters

##### request

`GrantRequest`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AccessProvider.grant`

***

### list()

> **list**(`request`): `Promise`\<`RelationTuple`[]\>

조건에 맞는 관계 튜플 목록을 조회합니다.

#### Parameters

##### request

`ListRequest`

#### Returns

`Promise`\<`RelationTuple`[]\>

#### Implementation of

`AccessProvider.list`

***

### revoke()

> **revoke**(`request`): `Promise`\<`void`\>

관계 튜플을 삭제합니다.

#### Parameters

##### request

`RevokeRequest`

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AccessProvider.revoke`
