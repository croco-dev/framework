---
editUrl: false
next: false
prev: false
title: "validateReferralProgramEditor"
---

> **validateReferralProgramEditor**(`draft`, `now?`): [`ReferralProgramEditorResult`](/api/admin-core/src/type-aliases/referralprogrameditorresult/)

Validates an operator program draft into a registerable program input.
Family limits never reset on revision alone: a fresh allowance always
requires a new explicit benefitCycleId, and registration keeps the pinned
per-subject receipt rule.

## Parameters

### draft

[`ReferralProgramEditorDraft`](/api/admin-core/src/type-aliases/referralprogrameditordraft/)

### now?

`Date` = `...`

## Returns

[`ReferralProgramEditorResult`](/api/admin-core/src/type-aliases/referralprogrameditorresult/)
