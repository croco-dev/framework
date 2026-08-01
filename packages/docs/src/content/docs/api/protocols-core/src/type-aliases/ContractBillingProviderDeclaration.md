---
editUrl: false
next: false
prev: false
title: "ContractBillingProviderDeclaration"
---

> **ContractBillingProviderDeclaration** = `object`

## Properties

### capabilities

> `readonly` **capabilities**: `object`

#### checkout

> `readonly` **checkout**: `object`

##### checkout.reason?

> `readonly` `optional` **reason?**: `string`

##### checkout.supported

> `readonly` **supported**: `boolean`

#### usage

> `readonly` **usage**: `object`

##### usage.reason?

> `readonly` `optional` **reason?**: `string`

##### usage.supported

> `readonly` **supported**: `boolean`

---

### providerName

> `readonly` **providerName**: `string`

---

### sourceLocation?

> `readonly` `optional` **sourceLocation?**: [`ContractDiagnosticSourceLocation`](/api/protocols-core/src/type-aliases/contractdiagnosticsourcelocation/)
