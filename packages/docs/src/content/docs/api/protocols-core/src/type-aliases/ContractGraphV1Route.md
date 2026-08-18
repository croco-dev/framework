---
editUrl: false
next: false
prev: false
title: "ContractGraphV1Route"
---

> **ContractGraphV1Route** = `object`

REST route contract with schemas, problems, policies, runtime requirements, and DI references.

## Properties

### di

> `readonly` **di**: readonly [`ContractGraphV1DiRef`](/api/protocols-core/src/type-aliases/contractgraphv1diref/)[]

---

### id

> `readonly` **id**: `string`

---

### inputSchemas

> `readonly` **inputSchemas**: `object`

#### body

> `readonly` **body**: [`ContractSchemaSnapshot`](/api/protocols-core/src/type-aliases/contractschemasnapshot/) \| `null`

#### headers

> `readonly` **headers**: [`ContractSchemaSnapshot`](/api/protocols-core/src/type-aliases/contractschemasnapshot/) \| `null`

#### path

> `readonly` **path**: [`ContractSchemaSnapshot`](/api/protocols-core/src/type-aliases/contractschemasnapshot/) \| `null`

#### query

> `readonly` **query**: [`ContractSchemaSnapshot`](/api/protocols-core/src/type-aliases/contractschemasnapshot/) \| `null`

---

### method

> `readonly` **method**: `string`

---

### outputSchema

> `readonly` **outputSchema**: [`ContractSchemaSnapshot`](/api/protocols-core/src/type-aliases/contractschemasnapshot/) \| `null`

---

### path

> `readonly` **path**: `string`

---

### policies

> `readonly` **policies**: readonly [`ContractGraphV1PolicyRef`](/api/protocols-core/src/type-aliases/contractgraphv1policyref/)[]

---

### problems

> `readonly` **problems**: readonly [`ContractGraphSnapshotProblemResponse`](/api/protocols-core/src/type-aliases/contractgraphsnapshotproblemresponse/)[]

---

### protocol

> `readonly` **protocol**: `"rest"`

---

### runtime

> `readonly` **runtime**: readonly [`ContractGraphV1RuntimeRequirement`](/api/protocols-core/src/type-aliases/contractgraphv1runtimerequirement/)[]

---

### source

> `readonly` **source**: [`ContractGraphSnapshotRouteContract`](/api/protocols-core/src/type-aliases/contractgraphsnapshotroutecontract/)\[`"sourceLocation"`\] \| `null`
