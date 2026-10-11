---
editUrl: false
next: false
prev: false
title: "AnalyticsOutboxConsumer"
---

## Type Parameters

### TClient

`TClient` = `unknown`

## Constructors

### Constructor

> **new AnalyticsOutboxConsumer**\<`TClient`\>(`config`): `AnalyticsOutboxConsumer`\<`TClient`\>

#### Parameters

##### config

[`AnalyticsConsumerConfig`](/api/etl-events-tx/src/type-aliases/analyticsconsumerconfig/)\<`TClient`\>

#### Returns

`AnalyticsOutboxConsumer`\<`TClient`\>

## Methods

### handle()

> **handle**(`message`): `Promise`\<[`AnalyticsOutcome`](/api/etl-events-tx/src/type-aliases/analyticsoutcome/)\>

#### Parameters

##### message

[`TransactionalOutboxMessage`](/api/events-tx/src/type-aliases/transactionaloutboxmessage/)

#### Returns

`Promise`\<[`AnalyticsOutcome`](/api/etl-events-tx/src/type-aliases/analyticsoutcome/)\>

---

### replayById()

> **replayById**(`messageId`, `retention`): `Promise`\<[`ReplayOutcome`](/api/etl-events-tx/src/type-aliases/replayoutcome/)\>

#### Parameters

##### messageId

`string`

##### retention

[`SourceRetention`](/api/etl-events-tx/src/type-aliases/sourceretention/)

#### Returns

`Promise`\<[`ReplayOutcome`](/api/etl-events-tx/src/type-aliases/replayoutcome/)\>
