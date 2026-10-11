---
editUrl: false
next: false
prev: false
title: "ProposeAnalysisPlan"
---

> **ProposeAnalysisPlan** = (`request`) => `Promise`\<[`AnalysisModelResponse`](/api/analytics-core/src/type-aliases/analysismodelresponse/)\>

Implementations must honor request.signal and settle promptly after it aborts.
The service retains the concurrency slot until this promise settles, including
after cancellation or timeout. A provider that never settles keeps its slot occupied.

## Parameters

### request

[`AnalysisModelRequest`](/api/analytics-core/src/type-aliases/analysismodelrequest/)

## Returns

`Promise`\<[`AnalysisModelResponse`](/api/analytics-core/src/type-aliases/analysismodelresponse/)\>
