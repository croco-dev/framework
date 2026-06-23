---
editUrl: false
next: false
prev: false
title: "MembershipUpdatedEvent"
---

멤버십 역할 업데이트 도메인 이벤트

## Description

멤버의 역할이 변경될 때 발행하는 이벤트입니다.

## Example

**이벤트 핸들러 등록**

```typescript
@RegisterEventHandler(MembershipUpdatedEvent)
class Handler implements EventHandler<MembershipUpdatedEvent> {
  async handle(event: MembershipUpdatedEvent) {}
}
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new MembershipUpdatedEvent**(`data`): `MembershipUpdatedEvent`

#### Parameters

##### data

`MembershipUpdatedEventData`

#### Returns

`MembershipUpdatedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### data

> `readonly` **data**: `MembershipUpdatedEventData`

---

### eventId

> `readonly` **eventId**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventId`](/api/events-core/src/classes/domainevent/#eventid)

---

### eventName

> `readonly` **eventName**: `string`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

---

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

---

### timestamp

> `readonly` **timestamp**: `Date`

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

---

### eventName

> `static` **eventName**: `string` = `"membership.updated"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
