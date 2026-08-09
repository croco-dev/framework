---
editUrl: false
next: false
prev: false
title: "ScenarioProblemFailure"
---

> **ScenarioProblemFailure** = `ScenarioFailureBase` & `object`

## Type Declaration

### kind

> `readonly` **kind**: `Exclude`\<[`ScenarioFailureKind`](/api/testing/src/type-aliases/scenariofailurekind/), `"duplicate-delivery"`\>

### occurrences

> `readonly` **occurrences**: `number`

### problem

> `readonly` **problem**: [`Problem`](/api/problems-core/src/classes/problem/)

### virtualTimeAdvance?

> `readonly` `optional` **virtualTimeAdvance?**: [`TestDuration`](/api/testing/src/type-aliases/testduration/)
