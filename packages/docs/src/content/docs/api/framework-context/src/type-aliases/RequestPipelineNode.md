---
editUrl: false
next: false
prev: false
title: "RequestPipelineNode"
---

> **RequestPipelineNode** = `object`

Request pipeline graph node.

Ordering is deterministic: path phase rank, numeric order, node kind, then id.
Same-phase/same-order nodes are not conflicts by themselves; add dependsOn when one
same-slot node must precede another for semantic correctness.

## Properties

### dependsOn?

> `readonly` `optional` **dependsOn?**: readonly `string`[]

---

### failurePropagation?

> `readonly` `optional` **failurePropagation?**: [`RequestPipelineFailurePropagation`](/api/framework-context/src/type-aliases/requestpipelinefailurepropagation/)

---

### id

> `readonly` **id**: `string`

---

### kind

> `readonly` **kind**: [`RequestPipelineNodeKind`](/api/framework-context/src/type-aliases/requestpipelinenodekind/)

---

### label?

> `readonly` `optional` **label?**: `string`

---

### order?

> `readonly` `optional` **order?**: `number`

---

### phase

> `readonly` **phase**: [`RequestPipelinePhase`](/api/framework-context/src/type-aliases/requestpipelinephase/)

---

### policyKind?

> `readonly` `optional` **policyKind?**: [`PolicyKind`](/api/framework-context/src/type-aliases/policykind/)

---

### source?

> `readonly` `optional` **source?**: [`PolicySource`](/api/framework-context/src/type-aliases/policysource/)
