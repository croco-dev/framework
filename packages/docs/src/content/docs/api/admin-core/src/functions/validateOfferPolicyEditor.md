---
editUrl: false
next: false
prev: false
title: "validateOfferPolicyEditor"
---

> **validateOfferPolicyEditor**(`draft`, `now?`): [`OfferPolicyEditorResult`](/api/admin-core/src/type-aliases/offerpolicyeditorresult/)

Validates an operator policy draft into a registerable policy input. Size,
period, caps, exclusions, and cost caps are parsed per field; the shared
registration validator enforces the cross-field budget and benefit rules.

## Parameters

### draft

[`OfferPolicyEditorDraft`](/api/admin-core/src/type-aliases/offerpolicyeditordraft/)

### now?

`Date` = `...`

## Returns

[`OfferPolicyEditorResult`](/api/admin-core/src/type-aliases/offerpolicyeditorresult/)
