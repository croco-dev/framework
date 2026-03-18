---
editUrl: false
next: false
prev: false
title: "EventSubscriptionIndex"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:149](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L149)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:154](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L154)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:224](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L224)

#### Returns

`void`

***

### delete()

> **delete**(`pattern`, `value`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:178](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L178)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:201](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/events-core/src/libs/EventBus.ts#L201)

#### Parameters

##### eventName

`string`

#### Returns

`Set`\<`TValue`\>
