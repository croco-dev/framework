---
editUrl: false
next: false
prev: false
title: "bootstrapConfig"
---

## Call Signature

> **bootstrapConfig**\<`TSchema`\>(`definition`, `env?`): `output`\<`TSchema`\>

### Type Parameters

#### TSchema

`TSchema` _extends_ `ZodType`\<`unknown`, `unknown`, `$ZodTypeInternals`\<`unknown`, `unknown`\>\>

### Parameters

#### definition

[`ConfigDefinition`](/api/framework-config/src/type-aliases/configdefinition/)\<`TSchema`\>

#### env?

`Record`\<`string`, `string` \| `undefined`\>

### Returns

`output`\<`TSchema`\>

## Call Signature

> **bootstrapConfig**(`target`, `env?`): `unknown`

:::caution[Deprecated]
Use `defineConfig(schema)` and pass the returned definition to `bootstrapConfig`.
:::

### Parameters

#### target

`Constructor`

#### env?

`Record`\<`string`, `string` \| `undefined`\>

### Returns

`unknown`
