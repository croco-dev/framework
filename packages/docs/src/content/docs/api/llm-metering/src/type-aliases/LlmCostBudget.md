---
editUrl: false
next: false
prev: false
title: "LlmCostBudget"
---

> **LlmCostBudget** = `object`

테넌트별 LLM 비용 제한입니다.

## Properties

### dailyLimit

> **dailyLimit**: `number`

하루 동안 허용되는 최대 비용입니다.

***

### monthlyLimit?

> `optional` **monthlyLimit?**: `number`

한 달 동안 허용되는 최대 비용입니다.

***

### tenantId

> **tenantId**: `string`

제한을 적용할 테넌트 식별자입니다.
