---
editUrl: false
next: false
prev: false
title: "CrocoPluginConfig"
---

## Properties

### di?

> `optional` **di?**: `object`

#### bindings?

> `optional` **bindings?**: readonly `object`[]

#### enabled?

> `optional` **enabled?**: `boolean`

#### graphId?

> `optional` **graphId?**: `string`

#### manifestFile?

> `optional` **manifestFile?**: `string`

#### moduleProviders?

> `optional` **moduleProviders?**: readonly `object`[]

#### modules?

> `optional` **modules?**: readonly `object`[]

#### outFile?

> `optional` **outFile?**: `string`

#### packageDescriptors?

> `optional` **packageDescriptors?**: `string`[]

#### tsconfig?

> `optional` **tsconfig?**: `string`

---

### ~~generateRegistry?~~

> `optional` **generateRegistry?**: `object`

:::caution[Deprecated]
Use `di` generated graph options.
:::

#### ~~enabled~~

> **enabled**: `boolean`

#### ~~outDir?~~

> `optional` **outDir?**: `string`

#### ~~outFile?~~

> `optional` **outFile?**: `string`

---

### reflectMetadata?

> `optional` **reflectMetadata?**: `boolean`

---

### scan?

> `optional` **scan?**: `object`

#### cache?

> `optional` **cache?**: `boolean`

#### ~~decorators?~~

> `optional` **decorators?**: `string`[]

:::caution[Deprecated]
Croco stereotypes are recognized by symbol identity.
:::

#### dirs?

> `optional` **dirs?**: `string`[]

#### exclude?

> `optional` **exclude?**: `string`[]

---

### watch?

> `optional` **watch?**: `object`

#### debounce?

> `optional` **debounce?**: `number`

#### optimize?

> `optional` **optimize?**: `boolean`
