---
editUrl: false
next: false
prev: false
title: "quoteDiscount"
---

> **quoteDiscount**(`input`): [`DiscountQuote`](/api/promotions-core/src/type-aliases/discountquote/)

Pure discount quote over whole minor units. Mixed currencies fail instead
of guessing a conversion, and an unsupported provider is reported as
`supported: false` rather than a fabricated grant.

## Parameters

### input

[`QuoteDiscountInput`](/api/promotions-core/src/type-aliases/quotediscountinput/)

## Returns

[`DiscountQuote`](/api/promotions-core/src/type-aliases/discountquote/)
