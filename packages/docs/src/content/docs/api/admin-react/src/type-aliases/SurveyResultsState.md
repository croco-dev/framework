---
editUrl: false
next: false
prev: false
title: "SurveyResultsState"
---

> **SurveyResultsState** = \{ `kind`: `"loading"` \| `"empty"` \| `"denied"`; \} \| \{ `kind`: `"error"`; `message`: `string`; \} \| \{ `data`: [`SurveyResultsData`](/api/admin-react/src/type-aliases/surveyresultsdata/); `kind`: `"ready"` \| `"partial"`; `message?`: `string`; `responses?`: readonly [`SurveyResponse`](/api/research-core/src/type-aliases/surveyresponse/)[]; \}
