---
editUrl: false
next: false
prev: false
title: "ActivationGuideOperations"
---

The host checks access again at the server boundary before executing each operation.

## Methods

### load()

> **load**(`access`): `Promise`\<[`ActivationGuideState`](/api/admin-core/src/type-aliases/activationguidestate/)\>

#### Parameters

##### access

[`ActivationGuideAccess`](/api/admin-core/src/type-aliases/activationguideaccess/)

#### Returns

`Promise`\<[`ActivationGuideState`](/api/admin-core/src/type-aliases/activationguidestate/)\>

---

### preview()

> **preview**(`request`, `access`): `Promise`\<[`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/)\>

#### Parameters

##### request

[`ActivationGuidePreviewRequest`](/api/admin-core/src/type-aliases/activationguidepreviewrequest/)

##### access

[`ActivationGuideAccess`](/api/admin-core/src/type-aliases/activationguideaccess/)

#### Returns

`Promise`\<[`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/)\>

---

### publish()

> **publish**(`request`, `access`): `Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`GoalDefinition`](/api/onboarding-core/src/type-aliases/goaldefinition/); `reason`: `string`; `revision`: `number`; \}\>\>

#### Parameters

##### request

[`ActivationGuidePublishRequest`](/api/admin-core/src/type-aliases/activationguidepublishrequest/)

##### access

[`ActivationGuideAccess`](/api/admin-core/src/type-aliases/activationguideaccess/)

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`GoalDefinition`](/api/onboarding-core/src/type-aliases/goaldefinition/); `reason`: `string`; `revision`: `number`; \}\>\>
