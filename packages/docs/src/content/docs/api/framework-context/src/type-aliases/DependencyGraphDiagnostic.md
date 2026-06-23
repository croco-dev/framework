---
editUrl: false
next: false
prev: false
title: "DependencyGraphDiagnostic"
---

> **DependencyGraphDiagnostic** = `object`

## Properties

### code

> `readonly` **code**: [`DependencyGraphDiagnosticCode`](/api/framework-context/src/type-aliases/dependencygraphdiagnosticcode/)

---

### message

> `readonly` **message**: `string`

---

### path

> `readonly` **path**: readonly `string`[]

---

### pathIds

> `readonly` **pathIds**: readonly `string`[]

---

### severity

> `readonly` **severity**: `"error"`

---

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`DependencySourceLocation`](/api/framework-context/src/type-aliases/dependencysourcelocation/)

---

### status

> `readonly` **status**: `Exclude`\<[`DependencyResolutionTraceStatus`](/api/framework-context/src/type-aliases/dependencyresolutiontracestatus/), `"ready"` \| `"resolved"`\>

---

### token

> `readonly` **token**: `string`

---

### tokenId

> `readonly` **tokenId**: `string`

---

### trace

> `readonly` **trace**: [`DependencyResolutionTrace`](/api/framework-context/src/type-aliases/dependencyresolutiontrace/)
