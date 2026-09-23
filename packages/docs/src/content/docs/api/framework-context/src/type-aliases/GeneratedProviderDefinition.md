---
editUrl: false
next: false
prev: false
title: "GeneratedProviderDefinition"
---

> **GeneratedProviderDefinition**\<`T`\> = `object`

## Type Parameters

### T

`T` = `unknown`

## Properties

### debugName

> `readonly` **debugName**: `string`

---

### dependencies

> `readonly` **dependencies**: readonly [`GeneratedProviderDependency`](/api/framework-context/src/type-aliases/generatedproviderdependency/)[]

---

### factory

> `readonly` **factory**: (`resolver`) => `T`

#### Parameters

##### resolver

[`GeneratedProviderResolver`](/api/framework-context/src/type-aliases/generatedproviderresolver/)

#### Returns

`T`

---

### kind?

> `readonly` `optional` **kind?**: [`GeneratedProviderKind`](/api/framework-context/src/type-aliases/generatedproviderkind/)

---

### moduleName?

> `readonly` `optional` **moduleName?**: `string`

---

### multiple?

> `readonly` `optional` **multiple?**: `boolean`

---

### scope

> `readonly` **scope**: [`Scope`](/api/framework-context/src/type-aliases/scope/)

---

### sourceLocation

> `readonly` **sourceLocation**: [`DependencySourceLocation`](/api/framework-context/src/type-aliases/dependencysourcelocation/)

---

### token

> `readonly` **token**: `TokenIdentifier`\<`T`\>

---

### tokenId

> `readonly` **tokenId**: `string`
