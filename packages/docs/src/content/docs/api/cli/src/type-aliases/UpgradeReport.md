---
editUrl: false
next: false
prev: false
title: "UpgradeReport"
---

> **UpgradeReport** = `object`

## Properties

### cwd

> `readonly` **cwd**: `string`

***

### findings

> `readonly` **findings**: readonly [`UpgradeFinding`](/api/cli/src/type-aliases/upgradefinding/)[]

***

### mode

> `readonly` **mode**: [`UpgradeReportMode`](/api/cli/src/type-aliases/upgradereportmode/)

***

### summary

> `readonly` **summary**: `object`

#### appliedCodemods

> `readonly` **appliedCodemods**: `number`

#### filesScanned

> `readonly` **filesScanned**: `number`

#### findings

> `readonly` **findings**: `number`

#### manualConfirmations

> `readonly` **manualConfirmations**: `number`

#### safeCodemods

> `readonly` **safeCodemods**: `number`

***

### version

> `readonly` **version**: `"croco.upgrade.report.v1"`
