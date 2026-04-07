---
editUrl: false
next: false
prev: false
title: "UsageRecordedEvent"
---

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:3](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L3)

사용량 기록 시 발행되는 도메인 이벤트입니다.

## Description

사용량이 성공적으로 기록되었을 때 발행되는 이벤트입니다.

## Example

```typescript
eventBus.publish(new UsageRecordedEvent({
  tenantId: 'tenant-123',
  meterId: 'api_calls',
  value: 1,
  recordedAt: new Date(),
  metadata: { endpoint: '/api/users' },
}));
```

## Extends

- [`DomainEvent`](/api/events-core/src/classes/domainevent/)

## Constructors

### Constructor

> **new UsageRecordedEvent**(`tenantId`, `meterId`, `value`, `idempotencyKey`, `metadata?`): `UsageRecordedEvent`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:6](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L6)

#### Parameters

##### tenantId

`string`

##### meterId

`string`

##### value

`number`

##### idempotencyKey

`string`

##### metadata?

`Record`\<`string`, `unknown`\>

#### Returns

`UsageRecordedEvent`

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`constructor`](/api/events-core/src/classes/domainevent/#constructor)

## Properties

### eventName

> `readonly` **eventName**: `string`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:18](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/DomainEvent.ts#L18)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname)

***

### idempotencyKey

> `readonly` **idempotencyKey**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:10](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L10)

***

### metadata

> **metadata**: [`DomainEventMetadata`](/api/events-core/src/type-aliases/domaineventmetadata/)

Defined in: [packages/events-core/src/libs/DomainEvent.ts:20](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/DomainEvent.ts#L20)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`metadata`](/api/events-core/src/classes/domainevent/#metadata)

***

### meterId

> `readonly` **meterId**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:8](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L8)

***

### tenantId

> `readonly` **tenantId**: `string`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:7](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L7)

***

### timestamp

> `readonly` **timestamp**: `Date`

Defined in: [packages/events-core/src/libs/DomainEvent.ts:19](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/events-core/src/libs/DomainEvent.ts#L19)

#### Inherited from

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`timestamp`](/api/events-core/src/classes/domainevent/#timestamp)

***

### value

> `readonly` **value**: `number`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:9](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L9)

***

### eventName

> `static` **eventName**: `string` = `'metering.usage_recorded'`

Defined in: [packages/metering-core/src/libs/events/UsageRecordedEvent.ts:4](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/metering-core/src/libs/events/UsageRecordedEvent.ts#L4)

#### Overrides

[`DomainEvent`](/api/events-core/src/classes/domainevent/).[`eventName`](/api/events-core/src/classes/domainevent/#eventname-1)
