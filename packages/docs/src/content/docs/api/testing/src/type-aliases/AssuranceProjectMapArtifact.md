---
editUrl: false
next: false
prev: false
title: "AssuranceProjectMapArtifact"
---

> **AssuranceProjectMapArtifact** = `object`

## Properties

### di?

> `readonly` `optional` **di?**: `object`

#### providers

> `readonly` **providers**: readonly `object`[]

***

### generatedArtifacts?

> `readonly` `optional` **generatedArtifacts?**: readonly `object`[]

***

### packageGraph?

> `readonly` `optional` **packageGraph?**: `object`

#### providerProfile?

> `readonly` `optional` **providerProfile?**: `object`

##### providerProfile.packages

> `readonly` **packages**: readonly `string`[]

##### providerProfile.profileName

> `readonly` **profileName**: `string`

***

### policies?

> `readonly` `optional` **policies?**: `object`

#### runtime?

> `readonly` `optional` **runtime?**: `object`

##### runtime.requiredCapabilities

> `readonly` **requiredCapabilities**: readonly `string`[]

##### runtime.target

> `readonly` **target**: `string`

***

### problems

> `readonly` **problems**: `object`

#### responses

> `readonly` **responses**: readonly `object`[]

***

### routeGraph

> `readonly` **routeGraph**: `object`

#### routes

> `readonly` **routes**: readonly `object`[]

***

### version

> `readonly` **version**: `"croco.project-map.manifest.v1"`
