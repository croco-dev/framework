---
editUrl: false
next: false
prev: false
title: "desktop"
---

> `const` **desktop**: `object`

## Type Declaration

### app

> **app**: \<`TContracts`, `TWindows`\>(`options`) => [`DesktopAppDefinition`](/api/protocols-desktop/src/type-aliases/desktopappdefinition/)\<`TContracts`, `TWindows`\>

#### Type Parameters

##### TContracts

`TContracts` _extends_ `Readonly`\<`Record`\<`string`, [`AnyDesktopContract`](/api/protocols-desktop/src/type-aliases/anydesktopcontract/)\>\>

##### TWindows

`TWindows` _extends_ `Readonly`\<`Record`\<`string`, [`AnyDesktopWindow`](/api/protocols-desktop/src/type-aliases/anydesktopwindow/)\>\>

#### Parameters

##### options

[`DesktopAppOptions`](/api/protocols-desktop/src/type-aliases/desktopappoptions/)\<`TContracts`, `TWindows`\> & `NoInvalidKeys`\<`TContracts`\> & `NoInvalidKeys`\<`TWindows`\>

#### Returns

[`DesktopAppDefinition`](/api/protocols-desktop/src/type-aliases/desktopappdefinition/)\<`TContracts`, `TWindows`\>

### contract

> **contract**: \<`TCommands`, `TEvents`, `TGrants`\>(`options`) => [`DesktopContractDefinition`](/api/protocols-desktop/src/type-aliases/desktopcontractdefinition/)\<`TCommands`, `TEvents`, `TGrants`\>

#### Type Parameters

##### TCommands

`TCommands` _extends_ `Readonly`\<`Record`\<`string`, [`AnyDesktopCommand`](/api/protocols-desktop/src/type-aliases/anydesktopcommand/)\>\> = `Record`\<`never`, `never`\>

##### TEvents

`TEvents` _extends_ `Readonly`\<`Record`\<`string`, [`AnyDesktopEvent`](/api/protocols-desktop/src/type-aliases/anydesktopevent/)\>\> = `Record`\<`never`, `never`\>

##### TGrants

`TGrants` _extends_ `Readonly`\<`Record`\<`string`, [`AnyDesktopGrant`](/api/protocols-desktop/src/type-aliases/anydesktopgrant/)\>\> = `Record`\<`never`, `never`\>

#### Parameters

##### options

[`DesktopContractOptions`](/api/protocols-desktop/src/type-aliases/desktopcontractoptions/)\<`TCommands`, `TEvents`, `TGrants`\> & `NoInvalidKeys`\<`TCommands`\> & `NoInvalidKeys`\<`TEvents`\> & `NoInvalidKeys`\<`TGrants`\> & `NoDuplicateMembers`\<`TCommands`, `TEvents`, `TGrants`\>

#### Returns

[`DesktopContractDefinition`](/api/protocols-desktop/src/type-aliases/desktopcontractdefinition/)\<`TCommands`, `TEvents`, `TGrants`\>

### event

> **event**: \<`TPayloadSchema`\>(`options`) => [`DesktopEventDefinition`](/api/protocols-desktop/src/type-aliases/desktopeventdefinition/)\<`TPayloadSchema`\>

#### Type Parameters

##### TPayloadSchema

`TPayloadSchema`

#### Parameters

##### options

[`DesktopEventOptions`](/api/protocols-desktop/src/type-aliases/desktopeventoptions/)\<`TPayloadSchema`\>

#### Returns

[`DesktopEventDefinition`](/api/protocols-desktop/src/type-aliases/desktopeventdefinition/)\<`TPayloadSchema`\>

### grant

> `readonly` **grant**: `object`

#### grant.directory

> **directory**: \<`TAccess`, `TScope`, `TLifetime`\>(`options`) => [`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"directory"`, `TAccess`, `TScope`, `TLifetime`\>

##### Type Parameters

###### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

###### TScope

`TScope` _extends_ [`DesktopGrantScope`](/api/protocols-desktop/src/type-aliases/desktopgrantscope/)

###### TLifetime

`TLifetime` _extends_ [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)

##### Parameters

###### options

[`DesktopDirectoryGrantOptions`](/api/protocols-desktop/src/type-aliases/desktopdirectorygrantoptions/)\<`TAccess`, `TScope`, `TLifetime`\>

##### Returns

[`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"directory"`, `TAccess`, `TScope`, `TLifetime`\>

#### grant.file

> **file**: \<`TAccess`, `TLifetime`\>(`options`) => [`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"file"`, `TAccess`, `"exact"`, `TLifetime`\>

##### Type Parameters

###### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

###### TLifetime

`TLifetime` _extends_ [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)

##### Parameters

###### options

[`DesktopFileGrantOptions`](/api/protocols-desktop/src/type-aliases/desktopfilegrantoptions/)\<`TAccess`, `TLifetime`\>

##### Returns

[`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"file"`, `TAccess`, `"exact"`, `TLifetime`\>

### mutation

> **mutation**: \<`TInputSchema`, `TOutputSchema`\>(`options`) => [`DesktopMutationDefinition`](/api/protocols-desktop/src/type-aliases/desktopmutationdefinition/)\<`TInputSchema`, `TOutputSchema`\>

#### Type Parameters

##### TInputSchema

`TInputSchema`

##### TOutputSchema

`TOutputSchema`

#### Parameters

##### options

[`DesktopMutationOptions`](/api/protocols-desktop/src/type-aliases/desktopmutationoptions/)\<`TInputSchema`, `TOutputSchema`\>

#### Returns

[`DesktopMutationDefinition`](/api/protocols-desktop/src/type-aliases/desktopmutationdefinition/)\<`TInputSchema`, `TOutputSchema`\>

### query

> **query**: \<`TInputSchema`, `TOutputSchema`\>(`options`) => [`DesktopQueryDefinition`](/api/protocols-desktop/src/type-aliases/desktopquerydefinition/)\<`TInputSchema`, `TOutputSchema`\>

#### Type Parameters

##### TInputSchema

`TInputSchema`

##### TOutputSchema

`TOutputSchema`

#### Parameters

##### options

[`DesktopQueryOptions`](/api/protocols-desktop/src/type-aliases/desktopqueryoptions/)\<`TInputSchema`, `TOutputSchema`\>

#### Returns

[`DesktopQueryDefinition`](/api/protocols-desktop/src/type-aliases/desktopquerydefinition/)\<`TInputSchema`, `TOutputSchema`\>

### window

> `readonly` **window**: `object`

#### window.local

> **local**: \<`TExpose`, `TReceive`\>(`options`) => [`DesktopLocalWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowdefinition/)\<`TExpose`, `TReceive`\>

##### Type Parameters

###### TExpose

`TExpose` _extends_ readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[] = readonly \[\]

###### TReceive

`TReceive` _extends_ readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[] = readonly \[\]

##### Parameters

###### options?

[`DesktopLocalWindowOptions`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowoptions/)\<`TExpose`, `TReceive`\> = `{}`

##### Returns

[`DesktopLocalWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowdefinition/)\<`TExpose`, `TReceive`\>

#### window.remote

> **remote**: \<`TInitialUrl`, `TAllowedOrigins`\>(`options`) => [`DesktopRemoteWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktopremotewindowdefinition/)\<`TInitialUrl`, `TAllowedOrigins`\>

##### Type Parameters

###### TInitialUrl

`TInitialUrl` _extends_ `string`

###### TAllowedOrigins

`TAllowedOrigins` _extends_ readonly `string`[]

##### Parameters

###### options

[`DesktopRemoteWindowOptions`](/api/protocols-desktop/src/type-aliases/desktopremotewindowoptions/)\<`TInitialUrl`, `TAllowedOrigins`\>

##### Returns

[`DesktopRemoteWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktopremotewindowdefinition/)\<`TInitialUrl`, `TAllowedOrigins`\>
