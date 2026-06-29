---
editUrl: false
next: false
prev: false
title: "MembershipCreatedEvent"
---

멤버십 생성 도메인 이벤트

## Description

사용자가 테넌트에 멤버로 추가될 때 발행하는 이벤트입니다.

## Example

**이벤트 핸들러 등록**

```typescript
@RegisterEventHandler(MembershipCreatedEvent)
class Handler implements EventHandler<MembershipCreatedEvent> {
  async handle(event: MembershipCreatedEvent) {
  }
}
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new MembershipCreatedEvent**(`data`): `MembershipCreatedEvent`

#### Parameters

##### data

`MembershipCreatedEventData`

#### Returns

`MembershipCreatedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### data

> `readonly` **data**: `MembershipCreatedEventData`

***

### eventId

> `readonly` **eventId**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventId`](/api/events-core/src/classes/domainevent/#eventid)

***

### eventName

> `readonly` **eventName**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### eventName

> `static` **eventName**: `string` = `"membership.created"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
