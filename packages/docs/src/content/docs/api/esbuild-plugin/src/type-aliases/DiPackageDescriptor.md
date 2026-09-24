---
editUrl: false
next: false
prev: false
title: "DiPackageDescriptor"
---

> **DiPackageDescriptor** = `object`

## Properties

### compilerVersion

> `readonly` **compilerVersion**: `string`

---

### graph

> `readonly` **graph**: `object`

#### exportName

> `readonly` **exportName**: `"generatedDiGraph"`

#### import

> `readonly` **import**: `string`

---

### inputHash

> `readonly` **inputHash**: `string`

---

### modules?

> `readonly` `optional` **modules?**: [`DiCompilerOptions`](/api/esbuild-plugin/src/type-aliases/dicompileroptions/)\[`"modules"`\]

---

### packageName

> `readonly` **packageName**: `string`

---

### packageVersion

> `readonly` **packageVersion**: `string`

---

### providers

> `readonly` **providers**: readonly [`DiManifestProvider`](/api/esbuild-plugin/src/type-aliases/dimanifestprovider/)[]

---

### roots

> `readonly` **roots**: readonly `string`[]

---

### version

> `readonly` **version**: _typeof_ [`DI_PACKAGE_DESCRIPTOR_VERSION`](/api/esbuild-plugin/src/variables/di_package_descriptor_version/)
