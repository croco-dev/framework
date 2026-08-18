---
editUrl: false
next: false
prev: false
title: "CohortAnalysisResult"
---

> **CohortAnalysisResult** = `object`

metrics-core에서 공통으로 사용하는 핵심 메트릭 타입들입니다.

## Properties

### cohorts

> **cohorts**: [`CohortData`](/api/metrics-core/src/type-aliases/cohortdata/)[]

***

### summary

> **summary**: `object`

#### averageRetentionByPeriod

> **averageRetentionByPeriod**: `Map`\<`number`, [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)\>

#### totalCohorts

> **totalCohorts**: `number`

#### weightedAverageRetention

> **weightedAverageRetention**: [`Percentage`](/api/metrics-core/src/type-aliases/percentage/)
