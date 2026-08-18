---
editUrl: false
next: false
prev: false
title: "DefinedProblemRegistryEntries"
---

> **DefinedProblemRegistryEntries**\<`Problems`\> = `{ readonly [Code in keyof Problems & string]: PackageProblemRegistryEntry<Code, Problems[Code]["category"], Problems[Code]["status"] extends number ? Problems[Code]["status"] : ProblemRegistryStatusForCategory<Problems[Code]["category"]>> }`\[keyof `Problems` & `string`\][]

## Type Parameters

### Problems

`Problems` *extends* [`ProblemRegistryProblemDefinitions`](/api/problems-core/src/type-aliases/problemregistryproblemdefinitions/)
