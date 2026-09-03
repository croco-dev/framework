---
editUrl: false
next: false
prev: false
title: "InMemoryDeadLetterItem"
---

> **InMemoryDeadLetterItem**\<`TEvent`\> = [`DeadLetterItem`](/api/events-core/src/type-aliases/deadletteritem/)\<`TEvent`\> & `object`

A dead-letter entry returned by [InMemoryDeadLetterQueue](/api/events-inmemory/src/classes/inmemorydeadletterqueue/).
`itemId` identifies one event-and-handler entry for precise removal.

## Type Declaration

### itemId

> `readonly` **itemId**: `string`

## Type Parameters

### TEvent

`TEvent` _extends_ [`DomainEvent`](/api/events-core/src/classes/domainevent/) = [`DomainEvent`](/api/events-core/src/classes/domainevent/)
