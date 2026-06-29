---
editUrl: false
next: false
prev: false
title: "InvoiceLineItem"
---

> **InvoiceLineItem** = `object`

billing account, invoice, order, plan, subscription 도메인 타입입니다.

## Properties

### description

> **description**: `string`

***

### id

> **id**: `string`

***

### periodEnd?

> `optional` **periodEnd?**: `Date`

***

### periodStart?

> `optional` **periodStart?**: `Date`

***

### quantity

> **quantity**: `number`

***

### total

> **total**: [`Money`](/api/billing-core/src/classes/money/)

***

### type

> **type**: [`InvoiceLineItemType`](/api/billing-core/src/type-aliases/invoicelineitemtype/)

***

### unitPrice

> **unitPrice**: [`Money`](/api/billing-core/src/classes/money/)
