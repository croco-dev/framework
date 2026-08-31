---
editUrl: false
next: false
prev: false
title: "WebhookLifecycleActionAdapter"
---

## Implements

- [`LifecycleActionAdapter`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/)

## Constructors

### Constructor

> **new WebhookLifecycleActionAdapter**(`fetchImpl?`, `options?`): `WebhookLifecycleActionAdapter`

#### Parameters

##### fetchImpl?

\{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

##### options?

[`WebhookLifecycleActionAdapterOptions`](/api/lifecycle-core/src/type-aliases/webhooklifecycleactionadapteroptions/) = `{}`

#### Returns

`WebhookLifecycleActionAdapter`

## Methods

### execute()

> **execute**(`action`, `context`, `run`): `Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>

#### Parameters

##### action

[`LifecycleAction`](/api/lifecycle-core/src/type-aliases/lifecycleaction/)

##### context

[`LifecycleContext`](/api/lifecycle-core/src/type-aliases/lifecyclecontext/)

##### run

`Pick`\<[`LifecycleRun`](/api/lifecycle-core/src/type-aliases/lifecyclerun/), `"id"` \| `"idempotencyKey"` \| `"ruleId"` \| `"ruleVersion"` \| `"ruleFingerprint"` \| `"tenantId"`\>

#### Returns

`Promise`\<[`LifecycleActionResult`](/api/lifecycle-core/src/type-aliases/lifecycleactionresult/)\>

#### Implementation of

[`LifecycleActionAdapter`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/).[`execute`](/api/lifecycle-core/src/interfaces/lifecycleactionadapter/#execute)
