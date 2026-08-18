---
editUrl: false
next: false
prev: false
title: "HealthScoreCalculator"
---

## Constructors

### Constructor

> **new HealthScoreCalculator**(): `HealthScoreCalculator`

#### Returns

`HealthScoreCalculator`

## Methods

### calculate()

> **calculate**(`signals`, `profile`): [`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

#### Parameters

##### signals

`object`[]

##### profile

[`HealthScoreProfile`](/api/customer-health-core/src/type-aliases/healthscoreprofile/)

#### Returns

[`TenantHealthScore`](/api/customer-health-core/src/type-aliases/tenanthealthscore/)

---

### determineTrend()

> **determineTrend**(`currentScore`, `previousScore?`): [`HealthTrend`](/api/customer-health-core/src/type-aliases/healthtrend/)

#### Parameters

##### currentScore

`number`

##### previousScore?

`number`

#### Returns

[`HealthTrend`](/api/customer-health-core/src/type-aliases/healthtrend/)
