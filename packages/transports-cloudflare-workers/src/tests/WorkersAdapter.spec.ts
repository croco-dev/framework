import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Body, Controller, Delete, Get, Param, Post, Put } from '@croco/protocols-rest';
import type { CrocoApp } from '@croco/transports-http';
import { createApp, ErrorHandler } from '@croco/transports-http';
import { HealthCheckRegistry } from '@croco/transports-http/src/libs/HealthCheckRegistry';
import { beforeEach, describe, expect, it } from 'vitest';
import { toWorkersHandler } from '../libs/adapters/WorkersAdapter';

describe('WorkersAdapter', () => {
  let app!: CrocoApp;
  const mockExecutionContext = {} as never;

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
    createUser(@Body() body: { name: string }) {
      return { created: true, data: body };
    }

    @Put('/users/:id')
    updateUser(@Param('id') id: string, @Body() body: { name: string }) {
      return { id, name: body.name };
    }

    @Delete('/users/:id')
    deleteUser(@Param('id') id: string) {
      return { deleted: true, id };
    }
  }

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
    Container.set(HealthCheckRegistry, new HealthCheckRegistry());

    app = createApp({ controllers: [TestController], securityValidation: 'off' });
  });

  describe('toWorkersHandler', () => {
    it('should return an object with fetch method', () => {
      const handler = toWorkersHandler(app);

      expect(handler).toBeDefined();
      expect(typeof handler.fetch).toBe('function');
    });

    it('should handle GET request and return app.fetch response', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/api/hello');
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ message: 'Hello, World!' });
    });

    it('should handle POST request with body', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'New User' }),
      });
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.created).toBe(true);
      expect(json.data).toEqual({ name: 'New User' });
    });

    it('should handle PUT request', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/api/users/1', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated User' }),
      });
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.id).toBe('1');
      expect(json.name).toBe('Updated User');
    });

    it('should handle DELETE request', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/api/users/1', {
        method: 'DELETE',
      });
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.deleted).toBe(true);
      expect(json.id).toBe('1');
    });

    it('should extract path params correctly', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/api/users/123');
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ id: '123', name: 'Test User' });
    });

    it('should return 404 for unknown routes', async () => {
      const handler = toWorkersHandler(app);
      const request = new Request('http://localhost/unknown');
      const env = {};
      const ctx = mockExecutionContext;

      const response = await handler.fetch(request, env, ctx);

      expect(response.status).toBe(404);
    });
  });
});
