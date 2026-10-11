---
editUrl: false
next: false
prev: false
title: "ActivationGuideConsoleProps"
---

> **ActivationGuideConsoleProps** = `Readonly`\<\{ `access`: [`ActivationGuideAccess`](/api/admin-core/src/type-aliases/activationguideaccess/); `asOf`: `string`; `definition`: [`GoalDefinition`](/api/onboarding-core/src/type-aliases/goaldefinition/); `state`: [`ActivationGuideState`](/api/admin-core/src/type-aliases/activationguidestate/); `targets`: readonly [`ActivationGuideTarget`](/api/admin-react/src/type-aliases/activationguidetarget/)[]; `onPreview`: `Promise`\<[`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/)\>; `onPublish`: `Promise`\<`Readonly`\<\{ `actor`: `string`; `definition`: [`GoalDefinition`](/api/onboarding-core/src/type-aliases/goaldefinition/); `reason`: `string`; `revision`: `number`; \}\>\>; \}\>
