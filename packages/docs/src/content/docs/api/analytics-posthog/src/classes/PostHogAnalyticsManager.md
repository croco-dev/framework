---
editUrl: false
next: false
prev: false
title: "PostHogAnalyticsManager"
---

Croco Context 정보를 활용해 PostHog 이벤트와 그룹 정보를 전송하는 분석 관리자입니다.

## Extends

- [`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/)

## Constructors

### Constructor

> **new PostHogAnalyticsManager**(`posthogClient`): `PostHogAnalyticsManager`

#### Parameters

##### posthogClient

[`PostHogClient`](/api/integrations-posthog/src/classes/posthogclient/)

#### Returns

`PostHogAnalyticsManager`

#### Overrides

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`constructor`](/api/analytics-core/src/classes/analyticsmanager/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/)\>

#### Inherited from

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`token`](/api/analytics-core/src/classes/analyticsmanager/#token)

## Methods

### capture()

> **capture**(`event`, `properties?`): `void`

Capture an event.
`userId` and `tenantId` will be automatically injected from Context if available.

#### Parameters

##### event

`string`

##### properties?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Overrides

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`capture`](/api/analytics-core/src/classes/analyticsmanager/#capture)

***

### flush()

> **flush**(): `Promise`\<`void`\>

Flush buffered analytics events before a runtime boundary such as Lambda return or shutdown.

#### Returns

`Promise`\<`void`\>

#### Overrides

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`flush`](/api/analytics-core/src/classes/analyticsmanager/#flush)

***

### group()

> **group**(`groupType`, `groupKey`, `properties?`): `void`

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

#### Overrides

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`group`](/api/analytics-core/src/classes/analyticsmanager/#group)

***

### identify()

> **identify**(`distinctId`, `properties?`): `void`

Identify a user.
Typically called after login or registration.

#### Parameters

##### distinctId

`string`

##### properties?

`Record`\<`string`, `unknown`\>

#### Returns

`void`

#### Overrides

[`AnalyticsManager`](/api/analytics-core/src/classes/analyticsmanager/).[`identify`](/api/analytics-core/src/classes/analyticsmanager/#identify)
