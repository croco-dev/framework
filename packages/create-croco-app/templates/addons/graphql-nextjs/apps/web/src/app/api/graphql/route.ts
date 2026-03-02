import 'reflect-metadata';
import { ApolloServer } from '@apollo/server';
import { startServerAndCreateNextHandler } from '@as-integrations/next';
import type { NextRequest } from 'next/server.js';
import { createSchema } from '../../../server/schema.js';

const server = new ApolloServer({ schema: await createSchema() });
const handler = startServerAndCreateNextHandler<NextRequest>(server);

export { handler as GET, handler as POST };
