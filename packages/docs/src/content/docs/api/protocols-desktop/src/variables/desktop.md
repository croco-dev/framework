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

`TContracts` *extends* `Readonly`\<`Record`\<`string`, [`AnyDesktopContract`](/api/protocols-desktop/src/type-aliases/anydesktopcontract/)\>\>

##### TWindows

`TWindows` *extends* `Readonly`\<`Record`\<`string`, [`AnyDesktopWindow`](/api/protocols-desktop/src/type-aliases/anydesktopwindow/)\>\>

#### Parameters

##### options

[`DesktopAppOptions`](/api/protocols-desktop/src/type-aliases/desktopappoptions/)\<`TContracts`, `TWindows`\> & `NoInvalidKeys`\<`TContracts`\> & `NoInvalidKeys`\<`TWindows`\>

#### Returns

[`DesktopAppDefinition`](/api/protocols-desktop/src/type-aliases/desktopappdefinition/)\<`TContracts`, `TWindows`\>

### contract

> **contract**: \<`TCommands`, `TEvents`, `TGrants`\>(`options`) => [`DesktopContractDefinition`](/api/protocols-desktop/src/type-aliases/desktopcontractdefinition/)\<`TCommands`, `TEvents`, `TGrants`\>

#### Type Parameters

##### TCommands

`TCommands` *extends* `Readonly`\<`Record`\<`string`, [`AnyDesktopCommand`](/api/protocols-desktop/src/type-aliases/anydesktopcommand/)\>\> = `Record`\<`never`, `never`\>

##### TEvents

`TEvents` *extends* `Readonly`\<`Record`\<`string`, [`AnyDesktopEvent`](/api/protocols-desktop/src/type-aliases/anydesktopevent/)\>\> = `Record`\<`never`, `never`\>

##### TGrants

`TGrants` *extends* `Readonly`\<`Record`\<`string`, [`AnyDesktopGrant`](/api/protocols-desktop/src/type-aliases/anydesktopgrant/)\>\> = `Record`\<`never`, `never`\>

#### Parameters

##### options

[`DesktopContractOptions`](/api/protocols-desktop/src/type-aliases/desktopcontractoptions/)\<`TCommands`, `TEvents`, `TGrants`\> & `NoInvalidKeys`\<`TCommands`\> & `NoInvalidKeys`\<`TEvents`\> & `NoInvalidKeys`\<`TGrants`\> & `NoDuplicateMembers`\<`TCommands`, `TEvents`, `TGrants`\> & `NoUnknownCommandEvents`\<`TCommands`, `TEvents`\>

#### Returns

[`DesktopContractDefinition`](/api/protocols-desktop/src/type-aliases/desktopcontractdefinition/)\<`TCommands`, `TEvents`, `TGrants`\>

### effect

> `readonly` **effect**: \<`TNamespace`, `TMethods`\>(`options`) => [`DesktopEffectDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectdefinition/)\<`TNamespace`, `TMethods`\> & `object`

#### Type Declaration

##### method

> **method**: \<`TArguments`, `TResult`\>() => [`DesktopEffectMethodDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectmethoddefinition/)\<`TArguments`, `TResult`\> = `effectMethod`

###### Type Parameters

###### TArguments

`TArguments` *extends* readonly `unknown`[]

###### TResult

`TResult`

###### Returns

[`DesktopEffectMethodDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectmethoddefinition/)\<`TArguments`, `TResult`\>

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

`TAccess` *extends* [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

###### TScope

`TScope` *extends* [`DesktopGrantScope`](/api/protocols-desktop/src/type-aliases/desktopgrantscope/)

###### TLifetime

`TLifetime` *extends* [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)

##### Parameters

###### options

[`DesktopDirectoryGrantOptions`](/api/protocols-desktop/src/type-aliases/desktopdirectorygrantoptions/)\<`TAccess`, `TScope`, `TLifetime`\>

##### Returns

[`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"directory"`, `TAccess`, `TScope`, `TLifetime`\>

#### grant.file

> **file**: \<`TAccess`, `TLifetime`\>(`options`) => [`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"file"`, `TAccess`, `"exact"`, `TLifetime`\>

##### Type Parameters

###### TAccess

`TAccess` *extends* [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

###### TLifetime

`TLifetime` *extends* [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)

##### Parameters

###### options

[`DesktopFileGrantOptions`](/api/protocols-desktop/src/type-aliases/desktopfilegrantoptions/)\<`TAccess`, `TLifetime`\>

##### Returns

[`DesktopGrantDefinition`](/api/protocols-desktop/src/type-aliases/desktopgrantdefinition/)\<`"file"`, `TAccess`, `"exact"`, `TLifetime`\>

### mutation

> **mutation**: \<`TOptions`\>(`options`) => [`DesktopMutationDefinition`](/api/protocols-desktop/src/type-aliases/desktopmutationdefinition/)\<`TOptions`\[`"input"`\], `TOptions`\[`"output"`\], `DeclaredEffects`\<`TOptions`\>, `DeclaredEvents`\<`TOptions`\>, `DeclaredProblems`\<`TOptions`\>\>

#### Type Parameters

##### TOptions

`TOptions` *extends* `AnyDesktopMutationOptions`

#### Parameters

##### options

`TOptions` & `ValidateEffects`\<`DeclaredEffects`\<`TOptions`\>\> & `ValidateEvents`\<`DeclaredEvents`\<`TOptions`\>\> & `ValidateProblems`\<`DeclaredProblems`\<`TOptions`\>\>

#### Returns

[`DesktopMutationDefinition`](/api/protocols-desktop/src/type-aliases/desktopmutationdefinition/)\<`TOptions`\[`"input"`\], `TOptions`\[`"output"`\], `DeclaredEffects`\<`TOptions`\>, `DeclaredEvents`\<`TOptions`\>, `DeclaredProblems`\<`TOptions`\>\>

### query

> **query**: \<`TOptions`\>(`options`) => [`DesktopQueryDefinition`](/api/protocols-desktop/src/type-aliases/desktopquerydefinition/)\<`TOptions`\[`"input"`\], `TOptions`\[`"output"`\], `DeclaredEffects`\<`TOptions`\>, `DeclaredEvents`\<`TOptions`\>, `DeclaredProblems`\<`TOptions`\>\>

#### Type Parameters

##### TOptions

`TOptions` *extends* `AnyDesktopQueryOptions`

#### Parameters

##### options

`TOptions` & `ValidateEffects`\<`DeclaredEffects`\<`TOptions`\>\> & `ValidateEvents`\<`DeclaredEvents`\<`TOptions`\>\> & `ValidateProblems`\<`DeclaredProblems`\<`TOptions`\>\>

#### Returns

[`DesktopQueryDefinition`](/api/protocols-desktop/src/type-aliases/desktopquerydefinition/)\<`TOptions`\[`"input"`\], `TOptions`\[`"output"`\], `DeclaredEffects`\<`TOptions`\>, `DeclaredEvents`\<`TOptions`\>, `DeclaredProblems`\<`TOptions`\>\>

### window

> `readonly` **window**: `object`

#### window.local

> **local**: \<`TExpose`, `TReceive`\>(`options`) => [`DesktopLocalWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowdefinition/)\<`TExpose`, `TReceive`\>

##### Type Parameters

###### TExpose

`TExpose` *extends* readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[] = readonly \[\]

###### TReceive

`TReceive` *extends* readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[] = readonly \[\]

##### Parameters

###### options?

[`DesktopLocalWindowOptions`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowoptions/)\<`TExpose`, `TReceive`\> = `{}`

##### Returns

[`DesktopLocalWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktoplocalwindowdefinition/)\<`TExpose`, `TReceive`\>

#### window.remote

> **remote**: \<`TInitialUrl`, `TAllowedOrigins`\>(`options`) => [`DesktopRemoteWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktopremotewindowdefinition/)\<`TInitialUrl`, `TAllowedOrigins`\>

##### Type Parameters

###### TInitialUrl

`TInitialUrl` *extends* `string`

###### TAllowedOrigins

`TAllowedOrigins` *extends* readonly `string`[]

##### Parameters

###### options

[`DesktopRemoteWindowOptions`](/api/protocols-desktop/src/type-aliases/desktopremotewindowoptions/)\<`TInitialUrl`, `TAllowedOrigins`\>

##### Returns

[`DesktopRemoteWindowDefinition`](/api/protocols-desktop/src/type-aliases/desktopremotewindowdefinition/)\<`TInitialUrl`, `TAllowedOrigins`\>
