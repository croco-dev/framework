---
editUrl: false
next: false
prev: false
title: "GoalProgressState"
---

> **GoalProgressState** = `Readonly`\<\{ `kind`: `"loading"`; \}\> \| `Readonly`\<\{ `kind`: `"empty"`; \}\> \| `Readonly`\<\{ `kind`: `"denied"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"error"`; `message`: `string`; `retry?`: () => `void`; \}\> \| `Readonly`\<\{ `kind`: `"partial"`; `message?`: `string`; `progress`: [`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/); \}\> \| `Readonly`\<\{ `kind`: `"ready"`; `message?`: `string`; `progress`: [`GoalProgress`](/api/onboarding-core/src/type-aliases/goalprogress/); \}\>
