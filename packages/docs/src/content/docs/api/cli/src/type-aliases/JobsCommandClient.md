---
editUrl: false
next: false
prev: false
title: "JobsCommandClient"
---

> **JobsCommandClient** = `object`

## Methods

### cancel()

> **cancel**(`id`, `params?`): `Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

##### params?

###### reason?

`string`

#### Returns

`Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>

***

### list()

> **list**(`options?`): `Promise`\<[`JobListReport`](/api/cli/src/type-aliases/joblistreport/)\>

#### Parameters

##### options?

[`JobsListFilters`](/api/cli/src/type-aliases/jobslistfilters/)

#### Returns

`Promise`\<[`JobListReport`](/api/cli/src/type-aliases/joblistreport/)\>

***

### logs()

> **logs**(`id`): `Promise`\<readonly [`JobLogEntry`](/api/cli/src/type-aliases/joblogentry/)[]\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<readonly [`JobLogEntry`](/api/cli/src/type-aliases/joblogentry/)[]\>

***

### replay()

> **replay**(`id`, `params?`): `Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

##### params?

###### reason?

`string`

#### Returns

`Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>

***

### show()

> **show**(`id`): `Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>

#### Parameters

##### id

`string`

#### Returns

`Promise`\<[`JobDetails`](/api/cli/src/type-aliases/jobdetails/)\>
