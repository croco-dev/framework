---
editUrl: false
next: false
prev: false
title: "EventSubscriptionIndex"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:153](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventBus.ts#L153)

이벤트 이름(예: `user.created`)과 구독 패턴(예: `user.*`)을 매칭하기 위한 인덱스입니다.

- 정확 매칭: O(1)
- 접두사 와일드카드(`prefix*`) : Trie 기반 O(|eventName|)
- 그 외(glob 패턴): 캐시된 정규식으로 O(#complexPatterns)

## Type Parameters

### TValue

`TValue`

## Constructors

### Constructor

> **new EventSubscriptionIndex**\<`TValue`\>(): `EventSubscriptionIndex`\<`TValue`\>

#### Returns

`EventSubscriptionIndex`\<`TValue`\>

## Methods

### add()

> **add**(`pattern`, `value`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:158](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventBus.ts#L158)

#### Parameters

##### pattern

`string`

##### value

`TValue`

#### Returns

`void`

***

### clear()

> **clear**(): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:228](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventBus.ts#L228)

#### Returns

`void`

***

### delete()

> **delete**(`pattern`, `value`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:182](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventBus.ts#L182)

#### Parameters

##### pattern

`string`

##### value

`TValue`

#### Returns

`void`

***

### match()

> **match**(`eventName`): `Set`\<`TValue`\>

Defined in: [packages/events-core/src/libs/EventBus.ts:205](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/events-core/src/libs/EventBus.ts#L205)

#### Parameters

##### eventName

`string`

#### Returns

`Set`\<`TValue`\>
