---
editUrl: false
next: false
prev: false
title: "ContractGraph"
---

> **ContractGraph** = `object`

## Properties

### controllers

> `readonly` **controllers**: readonly [`ContractGraphController`](/api/protocols-core/src/type-aliases/contractgraphcontroller/)[]

---

### diagnostics

> `readonly` **diagnostics**: readonly [`ContractDiagnostic`](/api/protocols-core/src/type-aliases/contractdiagnostic/)[]

---

### monetization?

> `readonly` `optional` **monetization?**: [`ContractMonetizationGraph`](/api/protocols-core/src/type-aliases/contractmonetizationgraph/)

Present on graphs built by current Croco versions. Optional for source compatibility with legacy graph literals.

---

### routes

> `readonly` **routes**: readonly [`ContractGraphRoute`](/api/protocols-core/src/type-aliases/contractgraphroute/)[]

---

### version

> `readonly` **version**: [`ContractGraphVersion`](/api/protocols-core/src/type-aliases/contractgraphversion/)
