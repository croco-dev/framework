---
editUrl: false
next: false
prev: false
title: "EngagementDeliveryEventProcessor"
---

Atomically deduplicates normalized delivery events and applies terminal endpoint policy.

## Constructors

### Constructor

> **new EngagementDeliveryEventProcessor**(`persistence`): `EngagementDeliveryEventProcessor`

#### Parameters

##### persistence

[`EngagementPersistence`](/api/engagement-core/src/interfaces/engagementpersistence/)

#### Returns

`EngagementDeliveryEventProcessor`

## Methods

### process()

> **process**(`input`): `Promise`\<`Readonly`\<\{ `event`: [`EngagementDeliveryEventRecordResult`](/api/engagement-core/src/type-aliases/engagementdeliveryeventrecordresult/); `invalidation?`: [`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/); \}\>\>

#### Parameters

##### input

[`RecordEngagementDeliveryEventInput`](/api/engagement-core/src/type-aliases/recordengagementdeliveryeventinput/)

#### Returns

`Promise`\<`Readonly`\<\{ `event`: [`EngagementDeliveryEventRecordResult`](/api/engagement-core/src/type-aliases/engagementdeliveryeventrecordresult/); `invalidation?`: [`ContactEndpointInvalidationResult`](/api/engagement-core/src/type-aliases/contactendpointinvalidationresult/); \}\>\>
