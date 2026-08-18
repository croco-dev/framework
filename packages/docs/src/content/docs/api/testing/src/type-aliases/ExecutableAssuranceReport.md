---
editUrl: false
next: false
prev: false
title: "ExecutableAssuranceReport"
---

> **ExecutableAssuranceReport** = `object`

## Properties

### contradictory

> `readonly` **contradictory**: readonly ([`AssuranceObligationAssessment`](/api/testing/src/type-aliases/assuranceobligationassessment/) \| [`AssuranceContradictoryEvidence`](/api/testing/src/type-aliases/assurancecontradictoryevidence/))[]

***

### graphVersion

> `readonly` **graphVersion**: *typeof* [`EXECUTABLE_ASSURANCE_GRAPH_VERSION`](/api/testing/src/variables/executable_assurance_graph_version/)

***

### missing

> `readonly` **missing**: readonly [`AssuranceObligationAssessment`](/api/testing/src/type-aliases/assuranceobligationassessment/)[]

***

### mode

> `readonly` **mode**: [`ExecutableAssuranceMode`](/api/testing/src/type-aliases/executableassurancemode/)

***

### satisfied

> `readonly` **satisfied**: readonly [`AssuranceObligationAssessment`](/api/testing/src/type-aliases/assuranceobligationassessment/)[]

***

### schemaVersion

> `readonly` **schemaVersion**: *typeof* [`EXECUTABLE_ASSURANCE_REPORT_VERSION`](/api/testing/src/variables/executable_assurance_report_version/)

***

### stale

> `readonly` **stale**: readonly [`AssuranceStaleEvidence`](/api/testing/src/type-aliases/assurancestaleevidence/)[]

***

### status

> `readonly` **status**: `"passed"` \| `"advisory"` \| `"failed"`

***

### summary

> `readonly` **summary**: `object`

#### blockingUnsatisfied

> `readonly` **blockingUnsatisfied**: `number`

#### contradictory

> `readonly` **contradictory**: `number`

#### missing

> `readonly` **missing**: `number`

#### satisfied

> `readonly` **satisfied**: `number`

#### stale

> `readonly` **stale**: `number`
