---
editUrl: false
next: false
prev: false
title: "BillingEventHandler"
---

이벤트 핸들러 계약 타입과 핸들러 클래스 타입입니다.

## Implements

- [`EventHandler`](/api/events-core/src/interfaces/eventhandler/)\<[`OrderPaidEvent`](/api/billing-core/src/classes/orderpaidevent/) \| [`PlanChangedEvent`](/api/billing-core/src/classes/planchangedevent/) \| [`SubscriptionCanceledEvent`](/api/billing-core/src/classes/subscriptioncanceledevent/)\>
- [`PlanProvider`](/api/metrics-core/src/interfaces/planprovider/)

## Constructors

### Constructor

> **new BillingEventHandler**(`planRegistry`, `billingStore`, `metricsRepository`): `BillingEventHandler`

#### Parameters

##### planRegistry

[`PlanRegistry`](/api/billing-core/src/interfaces/planregistry/)

##### billingStore

[`BillingStore`](/api/billing-core/src/classes/billingstore/)

##### metricsRepository

[`MetricsRepository`](/api/metrics-core/src/classes/metricsrepository/)

#### Returns

`BillingEventHandler`

## Methods

### getPlan()

> **getPlan**(`planId`): `Promise`\<\{ `amount`: `number`; `currency`: `string`; `id`: `string`; `interval`: [`PlanInterval`](/api/billing-core/src/type-aliases/planinterval/); `intervalCount`: `number`; \} \| `null`\>

#### Parameters

##### planId

`string`

#### Returns

`Promise`\<\{ `amount`: `number`; `currency`: `string`; `id`: `string`; `interval`: [`PlanInterval`](/api/billing-core/src/type-aliases/planinterval/); `intervalCount`: `number`; \} \| `null`\>

#### Implementation of

[`PlanProvider`](/api/metrics-core/src/interfaces/planprovider/).[`getPlan`](/api/metrics-core/src/interfaces/planprovider/#getplan)

---

### handle()

> **handle**(`event`): `Promise`\<`void`\>

#### Parameters

##### event

[`DomainEvent`](/api/events-core/src/classes/domainevent/)

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`EventHandler`](/api/events-core/src/interfaces/eventhandler/).[`handle`](/api/events-core/src/interfaces/eventhandler/#handle)
