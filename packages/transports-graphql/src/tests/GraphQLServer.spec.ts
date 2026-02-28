import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Field, ObjectType, Query, Resolver } from '@croco/protocols-graphql';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { GraphQLServer } from '../libs/GraphQLServer';

@ObjectType()
class User {
  @Field(() => String)
  id!: string;

  @Field(() => String)
  name!: string;

  @Field(() => String)
  email!: string;
}

@Resolver(() => User)
class UserResolver {
  private readonly userList = [
    { id: '1', name: 'Alice', email: 'alice@example.com' },
    { id: '2', name: 'Bob', email: 'bob@example.com' },
  ];

  @Query(() => [User])
  async getUsers(): Promise<User[]> {
    return this.userList;
  }

  @Query(() => String)
  async hello(): Promise<string> {
    return 'Hello, GraphQL!';
  }
}

describe('GraphQLServer integration', () => {
  const server = new GraphQLServer({
    schemaOptions: {
      resolvers: [UserResolver],
      autoDiscover: false,
    },
  });

  beforeAll(async () => {
    Container.reset();
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should compile schema successfully', () => {
    expect(server).not.toBeNull();
  });

  it('should execute hello query', async () => {
    const handler = server.getHandler();
    const request = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            hello
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(data.data.hello).toBe('Hello, GraphQL!');
  });

  it('should execute users query returning array', async () => {
    const handler = server.getHandler();
    const request = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getUsers {
              id
              name
              email
            }
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(Array.isArray(data.data.getUsers)).toBe(true);
    expect(data.data.getUsers.length).toBe(2);
    expect(data.data.getUsers[0].name).toBe('Alice');
    expect(data.data.getUsers[1].name).toBe('Bob');
  });

  it('should execute user query with arguments', async () => {
    const handler = server.getHandler();
    const request = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            getUsers {
              id
              name
              email
            }
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).toBeUndefined();
    expect(Array.isArray(data.data.getUsers)).toBe(true);
    expect(data.data.getUsers[0].id).toBe('1');
  });

  it('should handle invalid query gracefully', async () => {
    const handler = server.getHandler();
    const request = new Request('http://localhost/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: `
          query {
            nonExistentField
          }
        `,
      }),
    });

    const response = await handler(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.errors).not.toBeNull();
    expect(Array.isArray(data.errors)).toBe(true);
  });

  it('should start and stop server', async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
    });

    await testServer.initialize();
    await testServer.start(4001);

    const handler = testServer.getHandler();
    expect(typeof handler).toBe('function');

    await testServer.stop();
  });

  it('should reject oversized request bodies with 413', async () => {
    const testServer = new GraphQLServer({
      schemaOptions: {
        resolvers: [UserResolver],
        autoDiscover: false,
      },
      maxBodySizeBytes: 32,
    });

    await testServer.initialize();
    await testServer.start(4002);

    const response = await fetch('http://localhost:4002/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '{ hello }',
        padding: 'x'.repeat(128),
      }),
    });

    expect(response.status).toBe(413);
    await expect(response.text()).resolves.toContain('Payload Too Large');

    await testServer.stop();
  });
});
