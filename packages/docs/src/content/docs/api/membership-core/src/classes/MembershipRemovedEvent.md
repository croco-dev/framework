---
editUrl: false
next: false
prev: false
title: "MembershipRemovedEvent"
---

멤버십 제거 도메인 이벤트

## Description

사용자가 테넌트에서 제거될 때 발행하는 이벤트입니다.

## Example

**이벤트 핸들러 등록**

```typescript
@RegisterEventHandler(MembershipRemovedEvent)
class Handler implements EventHandler<MembershipRemovedEvent> {
  async handle(event: MembershipRemovedEvent) {}
}
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new MembershipRemovedEvent**(`data`, `eventId?`, `occurredAt?`): `MembershipRemovedEvent`

#### Parameters

##### data

`MembershipRemovedEventData`

##### eventId?

`string`

##### occurredAt?

`Date`

#### Returns

`MembershipRemovedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### data

> `readonly` **data**: `MembershipRemovedEventData`

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

> `static` **eventName**: `string` = `"membership.removed"`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
