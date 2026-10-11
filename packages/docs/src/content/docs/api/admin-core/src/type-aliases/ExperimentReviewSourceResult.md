---
editUrl: false
next: false
prev: false
title: "ExperimentReviewSourceResult"
---

> **ExperimentReviewSourceResult** = \{ `kind`: `"empty"`; `message?`: `string`; \} \| \{ `dataset`: [`ExperimentDatasetInput`](/api/metrics-core/src/type-aliases/experimentdatasetinput/); `generatedAt`: `Date`; `kind`: `"ready"`; `planHash?`: `string`; `sliceAttribute?`: `string`; `sourceRef?`: `string`; \} \| \{ `kind`: `"problem"`; `partial?`: \{ `dataset`: [`ExperimentDatasetInput`](/api/metrics-core/src/type-aliases/experimentdatasetinput/); `generatedAt`: `Date`; `planHash?`: `string`; `sliceAttribute?`: `string`; `sourceRef?`: `string`; \}; `problem`: [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/); \}
