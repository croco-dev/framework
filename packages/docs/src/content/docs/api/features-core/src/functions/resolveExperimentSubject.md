---
editUrl: false
next: false
prev: false
title: "resolveExperimentSubject"
---

> **resolveExperimentSubject**(`definition`, `identity`): [`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/) \| `null`

The host supplies verified identities. Switching never merges old anonymous assignments.

## Parameters

### definition

`Pick`\<[`ExperimentDefinition`](/api/features-core/src/type-aliases/experimentdefinition/), `"unit"` \| `"loginPolicy"`\>

### identity

#### anonymousId?

`string`

#### tenantId?

`string`

#### userId?

`string`

## Returns

[`ExperimentSubject`](/api/features-core/src/type-aliases/experimentsubject/) \| `null`
