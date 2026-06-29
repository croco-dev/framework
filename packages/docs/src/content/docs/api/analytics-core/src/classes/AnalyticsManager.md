---
editUrl: false
next: false
prev: false
title: "AnalyticsManager"
---

## Extended by

- [`PostHogAnalyticsManager`](/api/analytics-posthog/src/classes/posthoganalyticsmanager/)

## Constructors

### Constructor

> **new AnalyticsManager**(): `AnalyticsManager`

#### Returns

`AnalyticsManager`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`AnalyticsManager`\>

## Methods

### capture()

> `abstract` **capture**(`event`, `properties?`): `void`

Capture an event.
`userId` and `tenantId` will be automatically injected from Context if available.

#### Parameters

##### event

`string`

##### properties?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### group()

> `abstract` **group**(`groupType`, `groupKey`, `properties?`): `void`

Associate a user with a group (e.g., Tenant, Organization).
Essential for B2B SaaS analytics.

#### Parameters

##### groupType

`string`

##### groupKey

`string`

##### properties?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

***

### identify()

> `abstract` **identify**(`distinctId`, `properties?`): `void`

Identify a user.
Typically called after login or registration.

#### Parameters

##### distinctId

`string`

##### properties?

`Record`\<`string`, `unknown`\>

#### Returns

`void`
