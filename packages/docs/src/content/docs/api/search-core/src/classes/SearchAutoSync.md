---
editUrl: false
next: false
prev: false
title: "SearchAutoSync"
---

이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.

## Implements

- [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<[`DocumentIndexedEvent`](/api/search-core/src/classes/documentindexedevent/) \| [`DocumentDeletedEvent`](/api/search-core/src/classes/documentdeletedevent/)\>

## Constructors

### Constructor

> **new SearchAutoSync**(`failedEventPublisher?`): `SearchAutoSync`

#### Parameters

##### failedEventPublisher?

[`SearchSyncFailedEventPublisher`](/api/search-core/src/type-aliases/searchsyncfailedeventpublisher/)

#### Returns

`SearchAutoSync`

## Methods

### handle()

> **handle**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`DocumentIndexedEvent`](/api/search-core/src/classes/documentindexedevent/) \| [`DocumentDeletedEvent`](/api/search-core/src/classes/documentdeletedevent/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EventHandler`](/api/events-core/src/interfaces/eventhandler/).[`handle`](/api/events-core/src/interfaces/eventhandler/#handle)
