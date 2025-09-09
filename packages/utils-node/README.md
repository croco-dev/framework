## @croco/utils-node

Shared Node utilities for Croco services.

- createServer: Express + routing-controllers + TypeDI bootstrap helper
- createWorker: Provider-agnostic SQS worker with TypeDI container
- createApolloServer: Apollo Server on AWS Lambda with type-graphql + TypeDI

### Install
pnpm add @croco/utils-node

### Usage

createServer
```
import 'reflect-metadata';
import { createServer } from '@croco/utils-node';

const app = await createServer({
  controllers: [/* ... */],
  containerSetup: [/* register services */],
});
```

createWorker
```
import 'reflect-metadata';
import { createWorker } from '@croco/utils-node';

export const handler = await createWorker({
  getJob: name => JobRegistry.getJob(name),
  containerSetup: [/* register jobs/services */],
});
```

createApolloServer
```
import 'reflect-metadata';
import { createApolloServer } from '@croco/utils-node';

export const handler = createApolloServer({
  resolvers,
  authChecker,
  context: async ({ event, context }) => ({ /* ... */ }),
});
```
