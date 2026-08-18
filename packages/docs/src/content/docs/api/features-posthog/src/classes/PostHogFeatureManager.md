---
editUrl: false
next: false
prev: false
title: "PostHogFeatureManager"
---

PostHog feature flag를 조회하는 FeatureManager 구현체입니다.

## Extends

- [`FeatureManager`](/api/features-core/src/classes/featuremanager/)

## Constructors

### Constructor

> **new PostHogFeatureManager**(`posthogClient`): `PostHogFeatureManager`

#### Parameters

##### posthogClient

[`PostHogClient`](/api/integrations-posthog/src/classes/posthogclient/)

#### Returns

`PostHogFeatureManager`

#### Overrides

[`FeatureManager`](/api/features-core/src/classes/featuremanager/).[`constructor`](/api/features-core/src/classes/featuremanager/#constructor)

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<[`FeatureManager`](/api/features-core/src/classes/featuremanager/)\>

#### Inherited from

[`FeatureManager`](/api/features-core/src/classes/featuremanager/).[`token`](/api/features-core/src/classes/featuremanager/#token)

## Methods

### getVariant()

> **getVariant**(`flag`, `context?`): `Promise`\<`string` \| `boolean` \| `object`\>

Get the value of a feature flag.
Useful for multivariate flags or JSON configuration.

#### Parameters

##### flag

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`string` \| `boolean` \| `object`\>

#### Overrides

[`FeatureManager`](/api/features-core/src/classes/featuremanager/).[`getVariant`](/api/features-core/src/classes/featuremanager/#getvariant)

---

### isEnabled()

> **isEnabled**(`flag`, `context?`): `Promise`\<`boolean`\>

Check if a feature flag is enabled.
Context (userId, tenantId) will be automatically injected by the implementation if available,
but can be overridden by the `context` parameter.

#### Parameters

##### flag

`string`

##### context?

`Record`\<`string`, `unknown`\>

#### Returns

`Promise`\<`boolean`\>

#### Overrides

[`FeatureManager`](/api/features-core/src/classes/featuremanager/).[`isEnabled`](/api/features-core/src/classes/featuremanager/#isenabled)
