---
editUrl: false
next: false
prev: false
title: "ComponentScanner"
---

## Constructors

### Constructor

> **new ComponentScanner**(`options?`): `ComponentScanner`

#### Parameters

##### options?

[`CrocoPluginOptions`](/api/esbuild-plugin/src/interfaces/crocopluginoptions/) = `{}`

#### Returns

`ComponentScanner`

## Methods

### clearCache()

> **clearCache**(): `void`

#### Returns

`void`

***

### incrementalScan()

> **incrementalScan**(`changedFiles`, `baseDir`): `ScanResult`[]

#### Parameters

##### changedFiles

`string`[]

##### baseDir

`string`

#### Returns

`ScanResult`[]

***

### invalidateCache()

> **invalidateCache**(`filePath`): `void`

#### Parameters

##### filePath

`string`

#### Returns

`void`

***

### rescanFile()

> **rescanFile**(`filePath`): `ScanResult`

#### Parameters

##### filePath

`string`

#### Returns

`ScanResult`

***

### scan()

> **scan**(`baseDir?`): `ScanResult`[]

#### Parameters

##### baseDir?

`string` = `...`

#### Returns

`ScanResult`[]

***

### scanFile()

> **scanFile**(`filePath`): `ScanResult`

#### Parameters

##### filePath

`string`

#### Returns

`ScanResult`
