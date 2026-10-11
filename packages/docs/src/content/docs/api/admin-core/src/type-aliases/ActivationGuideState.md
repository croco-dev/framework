---
editUrl: false
next: false
prev: false
title: "ActivationGuideState"
---

> **ActivationGuideState** = `Readonly`\<\{ `kind`: `"loading"` \| `"empty"`; \}\> \| `Readonly`\<\{ `code`: `string`; `kind`: `"denied"` \| `"error"`; \}\> \| `Readonly`\<\{ `kind`: `"partial"` \| `"ready"`; `message?`: `string`; `preview?`: [`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/); `published`: [`ActivationGuidePublished`](/api/admin-core/src/type-aliases/activationguidepublished/); \}\>
