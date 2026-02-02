import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Body, Controller, Get, Param, Post } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../libs/CrocoApp';
import { ErrorHandler } from '../libs/ErrorHandler';

describe('CrocoApp', () => {
  beforeEach(() => {
    Container.reset();
    const logger = {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger;
    Container.set(Logger, logger);
    Container.set(ErrorHandler, new ErrorHandler(logger));
  });

  @Controller('/api')
  class TestController {
    @Get('/hello')
    hello() {
      return { message: 'Hello, World!' };
    }

    @Get('/users/:id')
    getUser(@Param('id') id: string) {
      return { id, name: 'Test User' };
    }

    @Post('/users')
    createUser(@Body() body: unknown) {
      return { created: true, data: body };
    }
  }

  it('should handle GET request', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/hello'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ message: 'Hello, World!' });
  });

  it('should extract path params', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/api/users/123'));

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json).toEqual({ id: '123', name: 'Test User' });
  });

  it('should handle POST with body', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(
      new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New User' }),
      })
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.created).toBe(true);
    expect(json.data).toEqual({ name: 'New User' });
  });

  it('should return 404 for unknown routes', async () => {
    const app = createApp({ controllers: [TestController] });

    const response = await app.fetch(new Request('http://localhost/unknown'));

    expect(response.status).toBe(404);
  });
});
