---
editUrl: false
next: false
prev: false
title: "DiCompilerManifest"
---

> **DiCompilerManifest** = `object`

## Properties

### compilerVersion

> `readonly` **compilerVersion**: _typeof_ [`DI_COMPILER_VERSION`](/api/esbuild-plugin/src/variables/di_compiler_version/)

---

### graphId

> `readonly` **graphId**: `string`

---

### inputHash

> `readonly` **inputHash**: `string`

---

### modules?

> `readonly` `optional` **modules?**: [`DiCompilerOptions`](/api/esbuild-plugin/src/type-aliases/dicompileroptions/)\[`"modules"`\]

---

### packages

> `readonly` **packages**: readonly [`DiLinkedPackage`](/api/esbuild-plugin/src/type-aliases/dilinkedpackage/)[]

---

### providers

> `readonly` **providers**: readonly [`DiManifestProvider`](/api/esbuild-plugin/src/type-aliases/dimanifestprovider/)[]

---

### roots

> `readonly` **roots**: readonly `string`[]

---

### scan

> `readonly` **scan**: `object`

#### excluded

> `readonly` **excluded**: readonly `string`[]

#### roots

> `readonly` **roots**: readonly `string`[]

---

### version

> `readonly` **version**: _typeof_ [`DI_MANIFEST_VERSION`](/api/esbuild-plugin/src/variables/di_manifest_version/)
