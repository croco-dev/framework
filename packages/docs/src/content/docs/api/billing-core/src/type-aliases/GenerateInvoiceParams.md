---
editUrl: false
next: false
prev: false
title: "GenerateInvoiceParams"
---

> **GenerateInvoiceParams** = `object`

인보이스 생성 계약과 입력 타입입니다.

## Properties

### billingAccountId

> **billingAccountId**: `string`

---

### currency

> **currency**: `string`

---

### dueAt?

> `optional` **dueAt?**: `Date`

---

### externalInvoiceId?

> `optional` **externalInvoiceId?**: `string`

---

### invoiceId

> **invoiceId**: `string`

---

### issuedAt

> **issuedAt**: `Date`

---

### lineItems

> **lineItems**: [`InvoiceLineItem`](/api/billing-core/src/type-aliases/invoicelineitem/)[]

---

### status?

> `optional` **status?**: [`InvoiceStatus`](/api/billing-core/src/type-aliases/invoicestatus/)
