---
editUrl: false
next: false
prev: false
title: "OfferCardState"
---

> **OfferCardState** = `Readonly`\<\{ `kind`: `"exposed"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `kind`: `"quoted"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `kind`: `"reserved"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `kind`: `"fulfilling"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `grantRef`: `string`; `kind`: `"fulfilled"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `kind`: `"expired"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); `reason`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"rejected"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); `reason`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"indeterminate"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); \}\> \| `Readonly`\<\{ `kind`: `"denied"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); `reason`: `string`; \}\> \| `Readonly`\<\{ `kind`: `"unavailable"`; `quote`: [`OfferQuote`](/api/promotions-core/src/type-aliases/offerquote/); `reason`: `string`; \}\>
