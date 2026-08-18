---
editUrl: false
next: false
prev: false
title: "ScenarioReplayProblemFailure"
---

> **ScenarioReplayProblemFailure** = `object`

## Properties

### boundary

> `readonly` **boundary**: [`ScenarioBoundary`](/api/testing/src/type-aliases/scenarioboundary/)

---

### kind

> `readonly` **kind**: `Exclude`\<[`ScenarioFailureKind`](/api/testing/src/type-aliases/scenariofailurekind/), `"duplicate-delivery"`\>

---

### occurrences

> `readonly` **occurrences**: `number`

---

### point

> `readonly` **point**: `string`

---

### problem

> `readonly` **problem**: [`ScenarioReplayProblemDetails`](/api/testing/src/type-aliases/scenarioreplayproblemdetails/)

---

### virtualTimeAdvanceMs?

> `readonly` `optional` **virtualTimeAdvanceMs?**: `number`
