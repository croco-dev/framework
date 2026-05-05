import 'reflect-metadata';
import type { AddressInfo } from 'node:net';
import { Body, Controller, Get, Param, Post } from '@croco/protocols-rest';
import { createTRPCClient, httpBatchLink, type TRPCClientError } from '@trpc/client';
import type { AnyRouter } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createTrpcRouter } from '../libs/createTrpcRouter';

type User = {
  readonly id: string;
  readonly name: string;
};

type UserRouterClient = {
  readonly user: {
    readonly list: { query: () => Promise<User[]> };
    readonly create: { mutate: (input: { readonly name: string }) => Promise<User> };
  };
};

const createUserSchema = z.object({ name: z.string().min(1) });

@Controller('/users')
class UserController {
  private readonly users: User[] = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];

  @Get('/')
  list(): User[] {
    return this.users;
  }

  @Get('/:id')
  getById(@Param('id') id: string): User | undefined {
    return this.users.find((user) => user.id === id);
  }

  @Post('/')
  create(@Body(createUserSchema) data: z.infer<typeof createUserSchema>): User {
    const newUser = { id: String(this.users.length + 1), name: data.name };

    this.users.push(newUser);

    return newUser;
  }
}

describe('tRPC round trip', () => {
  let server: ReturnType<typeof createHTTPServer>;
  let client: UserRouterClient;

  beforeAll(async () => {
    const router = createTrpcRouter([UserController]);

    server = createHTTPServer({ router });
    await new Promise<void>((resolve) => server.listen(0, resolve));

    client = createTRPCClient<typeof router>({
      links: [httpBatchLink({ url: `http://127.0.0.1:${getPort(server)}` })],
    }) as unknown as UserRouterClient;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  });

  it('should return data from a GET query', async () => {
    await expect(client.user.list.query()).resolves.toEqual([
      { id: '1', name: 'Alice' },
      { id: '2', name: 'Bob' },
    ]);
  });

  it('should create data through a POST mutation', async () => {
    await expect(client.user.create.mutate({ name: 'Carol' })).resolves.toEqual({ id: '3', name: 'Carol' });
  });

  it('should reject invalid input with BAD_REQUEST', async () => {
    await expect(client.user.create.mutate({ name: '' })).rejects.toMatchObject({
      data: expect.objectContaining({ code: 'BAD_REQUEST' }),
    } satisfies Partial<TRPCClientError<AnyRouter>>);
  });
});

function getPort(server: ReturnType<typeof createHTTPServer>): number {
  const address = server.address();

  if (!address || typeof address === 'string') {
    throw new TypeError('tRPC test server address is not available');
  }

  return (address as AddressInfo).port;
}
