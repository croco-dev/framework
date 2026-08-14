---
editUrl: false
next: false
prev: false
title: "CustomerHealthEventPublisher"
---

## Constructors

### Constructor

> **new CustomerHealthEventPublisher**(): `CustomerHealthEventPublisher`

#### Returns

`CustomerHealthEventPublisher`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`CustomerHealthEventPublisher`\>

## Methods

### publishIdempotently()

> `abstract` **publishIdempotently**(`event`): `Promise`\<`void`\>

Must deduplicate retries and concurrent deliveries by `event.eventId`.

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>
