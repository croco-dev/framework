---
editUrl: false
next: false
prev: false
title: "PlanReleaseService"
---

## Constructors

### Constructor

> **new PlanReleaseService**(`dependencies`): `PlanReleaseService`

#### Parameters

##### dependencies

[`PlanReleaseServiceDependencies`](/api/billing-core/src/type-aliases/planreleaseservicedependencies/)

#### Returns

`PlanReleaseService`

## Methods

### abandon()

> **abandon**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`PlanReleaseTransitionCommand`](/api/billing-core/src/type-aliases/planreleasetransitioncommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### cancelPublish()

> **cancelPublish**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`PlanReleaseTransitionCommand`](/api/billing-core/src/type-aliases/planreleasetransitioncommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### createDraft()

> **createDraft**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`CreatePlanDraftCommand`](/api/billing-core/src/type-aliases/createplandraftcommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### deliverPendingEvents()

> **deliverPendingEvents**(`ref?`): `Promise`\<[`PlanReleaseEventDeliveryResult`](/api/billing-core/src/type-aliases/planreleaseeventdeliveryresult/)\>

#### Parameters

##### ref?

[`PlanVersionRef`](/api/billing-core/src/type-aliases/planversionref/)

#### Returns

`Promise`\<[`PlanReleaseEventDeliveryResult`](/api/billing-core/src/type-aliases/planreleaseeventdeliveryresult/)\>

***

### publishNow()

> **publishNow**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`PublishPlanReleaseCommand`](/api/billing-core/src/type-aliases/publishplanreleasecommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### returnToDraft()

> **returnToDraft**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`PlanReleaseTransitionCommand`](/api/billing-core/src/type-aliases/planreleasetransitioncommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### schedulePublish()

> **schedulePublish**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`PlanReleaseTransitionCommand`](/api/billing-core/src/type-aliases/planreleasetransitioncommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### submitReview()

> **submitReview**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`SubmitPlanReviewCommand`](/api/billing-core/src/type-aliases/submitplanreviewcommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### supersede()

> **supersede**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`SupersedePlanReleaseCommand`](/api/billing-core/src/type-aliases/supersedeplanreleasecommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

***

### updateDraft()

> **updateDraft**(`command`): `Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>

#### Parameters

##### command

[`UpdatePlanDraftCommand`](/api/billing-core/src/type-aliases/updateplandraftcommand/)

#### Returns

`Promise`\<[`PlanRelease`](/api/billing-core/src/type-aliases/planrelease/)\>
