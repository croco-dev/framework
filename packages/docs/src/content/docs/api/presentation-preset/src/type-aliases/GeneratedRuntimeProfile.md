---
editUrl: false
next: false
prev: false
title: "GeneratedRuntimeProfile"
---

> **GeneratedRuntimeProfile** = `object`

## Properties

### generatedAppSmokeCase

> `readonly` **generatedAppSmokeCase**: `string`

create-croco-app generated smoke case that exercises this profile

***

### generatedAppSmokeCommand

> `readonly` **generatedAppSmokeCommand**: `string`

Focused command for re-running the generated smoke evidence

***

### name

> `readonly` **name**: `string`

Stable generated profile name used in tests and docs

***

### packageTestName

> `readonly` **packageTestName**: `string`

Named package test that validates this profile contract

***

### runtime

> `readonly` **runtime**: [`PresentationRuntime`](/api/presentation-preset/src/type-aliases/presentationruntime/)

Runtime claim this generated profile proves for the package catalog

***

### target

> `readonly` **target**: [`DeployTarget`](/api/presentation-preset/src/type-aliases/deploytarget/)

Runtime target metadata and expected output contract for the profile
