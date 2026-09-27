---
editUrl: false
next: false
prev: false
title: "previewCohort"
---

> **previewCohort**(`definition`, `registration`, `context`, `subjects`, `asOf`, `sampleSize?`): `Readonly`\<\{ `match`: `number`; `noMatch`: `number`; `sample`: readonly [`CohortMember`](/api/cohort-core/src/type-aliases/cohortmember/)[]; `total`: `number`; `unknown`: `number`; \}\>

## Parameters

### definition

[`CohortDefinition`](/api/cohort-core/src/type-aliases/cohortdefinition/)

### registration

[`CohortRegistration`](/api/cohort-core/src/type-aliases/cohortregistration/)

### context

[`CohortValidationContext`](/api/cohort-core/src/type-aliases/cohortvalidationcontext/)

### subjects

readonly `Readonly`\<\{ `coverage`: readonly `Readonly`\<\{ `event`: `string`; `from`: `string`; `to`: `string`; \}\>[]; `events`: readonly `Readonly`\<\{ `event`: `string`; `occurredAt`: `string`; \}\>[]; `facts`: `Readonly`\<`Record`\<`string`, [`CohortScalar`](/api/cohort-core/src/type-aliases/cohortscalar/) \| `null`\>\>; `memberships`: readonly `string`[]; `subjectId`: `string`; \}\>[]

### asOf

`string`

### sampleSize?

`number` = `50`

## Returns

`Readonly`\<\{ `match`: `number`; `noMatch`: `number`; `sample`: readonly [`CohortMember`](/api/cohort-core/src/type-aliases/cohortmember/)[]; `total`: `number`; `unknown`: `number`; \}\>
