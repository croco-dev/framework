---
editUrl: false
next: false
prev: false
title: "PostHogClient"
---

## Constructors

### Constructor

> **new PostHogClient**(`config`, `logger?`): `PostHogClient`

#### Parameters

##### config

[`PostHogConfig`](/api/integrations-posthog/src/interfaces/posthogconfig/)

##### logger?

[`ILogger`](/api/framework-context/src/interfaces/ilogger/)

#### Returns

`PostHogClient`

## Methods

### flush()

> **flush**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### getClient()

> **getClient**(): `PostHog`

#### Returns

`PostHog`

---

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>
