---
editUrl: false
next: false
prev: false
title: "ModuleProviderDefinition"
---

> **ModuleProviderDefinition**\<`T`\> = \{ `provide`: [`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`T`\>; `useValue`: `T`; \} \| \{ `provide`: [`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`T`\>; `useClass`: `Constructor`\<`T`\>; \} \| \{ `provide`: [`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`T`\>; `useFactory`: [`ModuleProviderFactory`](/api/framework-module/src/type-aliases/moduleproviderfactory/)\<`T`\>; \}

## Type Parameters

### T

`T` = `unknown`
