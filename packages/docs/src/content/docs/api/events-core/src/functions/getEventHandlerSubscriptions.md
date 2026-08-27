---
editUrl: false
next: false
prev: false
title: "getEventHandlerSubscriptions"
---

> **getEventHandlerSubscriptions**\<`TEvent`\>(`handlerClass`): [`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>[]

핸들러 클래스에 등록된 이벤트 구독 메타데이터를 조회합니다.

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Parameters

### handlerClass

[`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`TEvent`\>

## Returns

[`EventSubscription`](/api/events-core/src/interfaces/eventsubscription/)\<`TEvent`\>[]
