---
editUrl: false
next: false
prev: false
title: "SurveyRecord"
---

> **SurveyRecord** = \{ `familyId`: `string`; `id`: `string`; `kind`: `"definition"`; `value`: [`SurveyPublication`](/api/research-core/src/type-aliases/surveypublication/); \} \| \{ `familyId`: `string`; `id`: `string`; `kind`: `"invitation"`; `value`: [`SurveyInvitation`](/api/research-core/src/type-aliases/surveyinvitation/); \} \| \{ `familyId`: `string`; `id`: `string`; `kind`: `"response"`; `value`: [`SurveyResponse`](/api/research-core/src/type-aliases/surveyresponse/); \} \| \{ `familyId`: `string`; `id`: `string`; `kind`: `"audit"`; `value`: \{ `actor`: `string`; `at`: `string`; `idempotencyKey`: `string`; `operation`: `string`; `reason`: `string`; `revision`: `number`; \}; \}
