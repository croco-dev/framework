---
editUrl: false
next: false
prev: false
title: "standardizedMeanDifference"
---

> **standardizedMeanDifference**(`control`, `treatment`): [`StandardizedMeanDifference`](/api/metrics-core/src/type-aliases/standardizedmeandifference/)

Pooled-SD standardized mean difference between control and treatment samples.
Uses sqrt(((n1-1)s1^2 + (n2-1)s2^2) / (n1+n2-2)) with sample variances.
Identical constant groups with positive pooled degrees of freedom yield SMD 0.

## Parameters

### control

readonly `number`[]

### treatment

readonly `number`[]

## Returns

[`StandardizedMeanDifference`](/api/metrics-core/src/type-aliases/standardizedmeandifference/)

## Throws

If samples are empty or non-finite, pooled degrees of freedom
are insufficient, or pooled SD is zero without identical constant groups.
