---
editUrl: false
next: false
prev: false
title: "GraphQLServerOptions"
---

> **GraphQLServerOptions** = `object`

GraphQL server and schema compilation option types.

## Properties

### context?

> `optional` **context?**: (`req`) => `Promise`\<`Record`\<`string`, `unknown`\>\> \| `Record`\<`string`, `unknown`\>

#### Parameters

##### req

`Request`

#### Returns

`Promise`\<`Record`\<`string`, `unknown`\>\> \| `Record`\<`string`, `unknown`\>

***

### cors?

> `optional` **cors?**: `boolean` \| `YogaServerOptions`\<`Record`\<`string`, `unknown`\>, `unknown`\>\[`"cors"`\]

***

### graphqlEndpoint?

> `optional` **graphqlEndpoint?**: `string`

***

### maxBodySizeBytes?

> `optional` **maxBodySizeBytes?**: `number`

***

### plugins?

> `optional` **plugins?**: `YogaServerOptions`\<`Record`\<`string`, `unknown`\>, `unknown`\>\[`"plugins"`\]

***

### schema?

> `optional` **schema?**: `GraphQLSchema`

***

### schemaOptions?

> `optional` **schemaOptions?**: [`SchemaCompileOptions`](/api/transports-graphql/src/type-aliases/schemacompileoptions/)
