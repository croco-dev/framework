---
editUrl: false
next: false
prev: false
title: "DefaultHandlerResolver"
---

기본 핸들러 리졸버
new 연산자로 직접 핸들러 인스턴스를 생성합니다.
기존 동작과 호환됩니다.

## Implements

- [`HandlerResolver`](/api/events-core/src/interfaces/handlerresolver/)

## Constructors

### Constructor

> **new DefaultHandlerResolver**(): `DefaultHandlerResolver`

#### Returns

`DefaultHandlerResolver`

## Methods

### resolve()

> **resolve**\<`T`\>(`handlerClass`): [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>

#### Type Parameters

##### T

`T` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Parameters

##### handlerClass

[`EventHandlerClass`](/api/events-core/src/type-aliases/eventhandlerclass/)\<`T`\>

#### Returns

[`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<`T`\>

#### Implementation of

[`HandlerResolver`](/api/events-core/src/interfaces/handlerresolver/).[`resolve`](/api/events-core/src/interfaces/handlerresolver/#resolve)
