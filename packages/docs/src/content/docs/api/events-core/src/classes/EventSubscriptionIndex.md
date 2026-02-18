---
editUrl: false
next: false
prev: false
title: "EventSubscriptionIndex"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:140](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventBus.ts#L140)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:145](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventBus.ts#L145)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:215](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventBus.ts#L215)

#### Returns

`void`

***

### delete()

> **delete**(`pattern`, `value`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:169](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventBus.ts#L169)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:192](https://github.com/croco-dev/shared/blob/96dae0f2dbf01371c7f838c83a65d292e64240ad/packages/events-core/src/libs/EventBus.ts#L192)

#### Parameters

##### eventName

`string`

#### Returns

`Set`\<`TValue`\>
