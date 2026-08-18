---
editUrl: false
next: false
prev: false
title: "OutputContractValidator"
---

## Constructors

### Constructor

> **new OutputContractValidator**(): `OutputContractValidator`

#### Returns

`OutputContractValidator`

## Methods

### validate()

> **validate**(`contract`): [`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

#### Parameters

##### contract

[`OutputContract`](/api/presentation-preset/src/type-aliases/outputcontract/)

#### Returns

[`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

---

### validateDeployTarget()

> **validateDeployTarget**(`target`): [`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

#### Parameters

##### target

[`DeployTarget`](/api/presentation-preset/src/type-aliases/deploytarget/)

#### Returns

[`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

---

### validateGeneratedRuntimeProfile()

> **validateGeneratedRuntimeProfile**(`profile`): [`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

#### Parameters

##### profile

[`GeneratedRuntimeProfile`](/api/presentation-preset/src/type-aliases/generatedruntimeprofile/)

#### Returns

[`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

---

### validateGeneratedRuntimeProfileCatalog()

> **validateGeneratedRuntimeProfileCatalog**(`catalog`, `options?`): [`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)

#### Parameters

##### catalog

[`GeneratedRuntimeProfileCatalog`](/api/presentation-preset/src/type-aliases/generatedruntimeprofilecatalog/)

##### options?

[`RuntimeClaimValidationOptions`](/api/presentation-preset/src/type-aliases/runtimeclaimvalidationoptions/) = `{}`

#### Returns

[`ValidationReport`](/api/presentation-preset/src/type-aliases/validationreport/)
