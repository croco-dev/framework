---
editUrl: false
next: false
prev: false
title: "DesktopContractGraphDiagnostic"
---

> **DesktopContractGraphDiagnostic** = `object`

## Properties

### code

> `readonly` **code**: [`DesktopContractGraphDiagnosticCode`](/api/protocols-desktop/src/type-aliases/desktopcontractgraphdiagnosticcode/)

---

### ~~contractMember~~

> `readonly` **contractMember**: `string`

:::caution[Deprecated]
Use memberId. Retained for DesktopWire diagnostic compatibility.
:::

---

### memberId

> `readonly` **memberId**: `string`

---

### message

> `readonly` **message**: `string`

---

### recovery

> `readonly` **recovery**: `string`

---

### schemaPath

> `readonly` **schemaPath**: readonly `string`[]

---

### severity

> `readonly` **severity**: `"error"`

---

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`DesktopWireSourceLocation`](/api/protocols-desktop/src/type-aliases/desktopwiresourcelocation/)

---

### targetKind

> `readonly` **targetKind**: [`DesktopContractGraphDiagnosticTargetKind`](/api/protocols-desktop/src/type-aliases/desktopcontractgraphdiagnostictargetkind/)
