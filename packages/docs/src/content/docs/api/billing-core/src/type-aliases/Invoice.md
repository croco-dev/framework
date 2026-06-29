---
editUrl: false
next: false
prev: false
title: "Invoice"
---

> **Invoice** = `object`

billing account, invoice, order, plan, subscription 도메인 타입입니다.

## Properties

### billingAccountId

> **billingAccountId**: `string`

***

### currency

> **currency**: `string`

***

### dueAt?

> `optional` **dueAt?**: `Date`

***

### externalInvoiceId?

> `optional` **externalInvoiceId?**: `string`

***

### id

> **id**: `string`

***

### issuedAt

> **issuedAt**: `Date`

***

### lineItems

> **lineItems**: [`InvoiceLineItem`](/api/billing-core/src/type-aliases/invoicelineitem/)[]

***

### paidAt?

> `optional` **paidAt?**: `Date`

***

### status

> **status**: [`InvoiceStatus`](/api/billing-core/src/type-aliases/invoicestatus/)

***

### subtotal

> **subtotal**: [`Money`](/api/billing-core/src/classes/money/)

***

### total

> **total**: [`Money`](/api/billing-core/src/classes/money/)
