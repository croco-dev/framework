---
editUrl: false
next: false
prev: false
title: "EventSubscriptionIndex"
---

Defined in: [packages/events-core/src/libs/EventBus.ts:152](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L152)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:157](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L157)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:227](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L227)

#### Returns

`void`

***

### delete()

> **delete**(`pattern`, `value`): `void`

Defined in: [packages/events-core/src/libs/EventBus.ts:181](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L181)

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

Defined in: [packages/events-core/src/libs/EventBus.ts:204](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/events-core/src/libs/EventBus.ts#L204)

#### Parameters

##### eventName

`string`

#### Returns

`Set`\<`TValue`\>
