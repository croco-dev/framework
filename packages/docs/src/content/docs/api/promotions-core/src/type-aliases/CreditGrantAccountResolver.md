---
editUrl: false
next: false
prev: false
title: "CreditGrantAccountResolver"
---

> **CreditGrantAccountResolver** = (`input`) => `Promise`\<[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)\> \| [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)

## Parameters

### input

#### benefit

`Extract`\<[`OfferClaim`](/api/promotions-core/src/type-aliases/offerclaim/)\[`"benefit"`\], \{ `kind`: `"trial-credits"`; \}\>

#### subject

[`OfferSubject`](/api/promotions-core/src/type-aliases/offersubject/)

## Returns

`Promise`\<[`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)\> \| [`CreditAccountId`](/api/credits-core/src/type-aliases/creditaccountid/)
