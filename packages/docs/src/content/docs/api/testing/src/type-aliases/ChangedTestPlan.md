---
editUrl: false
next: false
prev: false
title: "ChangedTestPlan"
---

> **ChangedTestPlan** = `object`

## Properties

### base

> `readonly` **base**: `string`

***

### budget

> `readonly` **budget**: `object`

#### estimatedMs

> `readonly` **estimatedMs**: `number`

#### limitMs

> `readonly` **limitMs**: `number` \| `null`

#### overflowMs

> `readonly` **overflowMs**: `number`

#### unknownDurationTests

> `readonly` **unknownDurationTests**: readonly `string`[]

***

### changedContracts

> `readonly` **changedContracts**: readonly `string`[]

***

### commands

> `readonly` **commands**: readonly readonly `string`[][]

***

### excludedTests

> `readonly` **excludedTests**: readonly [`ChangedTestExclusion`](/api/testing/src/type-aliases/changedtestexclusion/)[]

***

### fallbacks

> `readonly` **fallbacks**: readonly [`ChangedTestFallback`](/api/testing/src/type-aliases/changedtestfallback/)[]

***

### head

> `readonly` **head**: `string`

***

### incomplete

> `readonly` **incomplete**: `boolean`

***

### mode

> `readonly` **mode**: `"shadow"` \| `"enforce"`

***

### requiredEvidence

> `readonly` **requiredEvidence**: readonly `string`[]

***

### schemaVersion

> `readonly` **schemaVersion**: *typeof* [`CHANGED_TEST_PLAN_VERSION`](/api/testing/src/variables/changed_test_plan_version/)

***

### selectedSuites

> `readonly` **selectedSuites**: readonly [`ChangedTestSuite`](/api/testing/src/type-aliases/changedtestsuite/)[]

***

### selectedTests

> `readonly` **selectedTests**: readonly `string`[]

***

### selectionReasons

> `readonly` **selectionReasons**: readonly [`ChangedTestSelectionReason`](/api/testing/src/type-aliases/changedtestselectionreason/)[]

***

### sourceLocations

> `readonly` **sourceLocations**: readonly [`ChangedTestSource`](/api/testing/src/type-aliases/changedtestsource/)[]
