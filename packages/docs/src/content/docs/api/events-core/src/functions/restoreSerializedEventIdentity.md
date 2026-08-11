---
editUrl: false
next: false
prev: false
title: "restoreSerializedEventIdentity"
---

> **restoreSerializedEventIdentity**(`event`, `eventId`, `occurredAt`): `void`

Restores the stable identity and occurrence time of a serialized event.
Use only while deserializing events or reconstructing completed events for redelivery.

## Parameters

### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

### eventId

`string`

### occurredAt

`string`

## Returns

`void`
