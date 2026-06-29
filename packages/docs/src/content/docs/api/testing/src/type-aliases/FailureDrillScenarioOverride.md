---
editUrl: false
next: false
prev: false
title: "FailureDrillScenarioOverride"
---

> **FailureDrillScenarioOverride** = `Partial`\<`Omit`\<[`FailureDrillScenario`](/api/testing/src/type-aliases/failuredrillscenario/), `"expected"` \| `"id"`\>\> & `object`

## Type Declaration

### expected?

> `readonly` `optional` **expected?**: `Partial`\<`Omit`\<[`FailureDrillExpectedOutcome`](/api/testing/src/type-aliases/failuredrillexpectedoutcome/), `"evidence"` \| `"problem"`\>\> & `object`

#### Type Declaration

##### evidence?

> `readonly` `optional` **evidence?**: `Partial`\<[`FailureDrillEvidenceExpectation`](/api/testing/src/type-aliases/failuredrillevidenceexpectation/)\>

##### problem?

> `readonly` `optional` **problem?**: `Partial`\<[`FailureDrillProblemExpectation`](/api/testing/src/type-aliases/failuredrillproblemexpectation/)\> & `object`

###### Type Declaration

###### code

> `readonly` **code**: `string`
