---
editUrl: false
next: false
prev: false
title: "PlanTransitionService"
---

플랜 전환 미리보기와 적용 계약입니다.

## Methods

### previewTransition()

> **previewTransition**(`params`): `Promise`\<[`PlanTransitionPreview`](/api/billing-core/src/type-aliases/plantransitionpreview/)\>

#### Parameters

##### params

[`PlanTransitionParams`](/api/billing-core/src/type-aliases/plantransitionparams/)

#### Returns

`Promise`\<[`PlanTransitionPreview`](/api/billing-core/src/type-aliases/plantransitionpreview/)\>

---

### transitionPlan()

> **transitionPlan**(`params`): `Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>

#### Parameters

##### params

[`PlanTransitionParams`](/api/billing-core/src/type-aliases/plantransitionparams/)

#### Returns

`Promise`\<[`Subscription`](/api/billing-core/src/type-aliases/subscription/)\>
