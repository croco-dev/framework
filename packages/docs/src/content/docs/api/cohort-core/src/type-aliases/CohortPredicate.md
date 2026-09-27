---
editUrl: false
next: false
prev: false
title: "CohortPredicate"
---

> **CohortPredicate** = `Readonly`\<\{ `children`: readonly `CohortPredicate`[]; `kind`: `"all"` \| `"any"`; \}\> \| `Readonly`\<\{ `child`: `CohortPredicate`; `kind`: `"not"`; \}\> \| `Readonly`\<\{ `field`: `string`; `kind`: `"fact"`; `operator`: [`CohortOperator`](/api/cohort-core/src/type-aliases/cohortoperator/); `value`: [`CohortScalar`](/api/cohort-core/src/type-aliases/cohortscalar/); \}\> \| `Readonly`\<\{ `event`: `string`; `kind`: `"event"`; `metric`: `"count"` \| `"distinct-calendar-days"`; `operator`: [`CohortOperator`](/api/cohort-core/src/type-aliases/cohortoperator/); `value`: `number`; `windowDays`: `number`; \}\> \| `Readonly`\<\{ `kind`: `"static"`; `membershipId`: `string`; \}\>
