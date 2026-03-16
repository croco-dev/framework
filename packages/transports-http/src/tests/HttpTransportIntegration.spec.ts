import 'reflect-metadata';
import type { Guard } from '@croco/framework-context';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import type { HttpContext } from '@croco/protocols-rest';
import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CrocoApp } from '../libs/CrocoApp';
import { createApp } from '../libs/CrocoApp';
import { ErrorHandler } from '../libs/ErrorHandler';
import { HealthCheckRegistry } from '../libs/HealthCheckRegistry';

class AuthGuard implements Guard {
  canActivate(context: HttpContext): boolean {
    const token = context.header('authorization');
    return token === 'Bearer valid-token';
  }
}

@Controller('/api/users')
class UserController {
  private users = [
    { id: '1', name: 'Alice' },
    { id: '2', name: 'Bob' },
  ];

  @Get()
  list(@Query('limit') limit?: string) {
    const l = limit ? parseInt(limit, 10) : this.users.length;
    return this.users.slice(0, l);
  }

  @Get('/:id')
  getById(@Param('id') id: string) {
    const user = this.users.find((u) => u.id === id);
    if (!user) throw new Error('Not found');
    return user;
  }

  @Post()
  create(@Body() body: { name: string }) {
    const newUser = { id: String(this.users.length + 1), name: body.name };
    this.users.push(newUser);
    return newUser;
  }

  @Put('/:id')
  update(@Param('id') id: string, @Body() body: { name: string }) {
    const user = this.users.find((u) => u.id === id);
    if (user) user.name = body.name;
    return user;
  }

  @Delete('/:id')
  @UseGuards(AuthGuard)
  delete(@Param('id') id: string) {
    const idx = this.users.findIndex((u) => u.id === id);
    if (idx !== -1) this.users.splice(idx, 1);
    return { deleted: true };
  }
}

describe('Transport Integration', () => {
  let app!: CrocoApp;

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

    app = createApp({ controllers: [UserController] });
  });

  describe('CRUD Operations', () => {
    it('GET /api/users - should list all users', async () => {
      const res = await app.fetch(new Request('http://localhost/api/users'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBeGreaterThan(0);
    });

    it('GET /api/users?limit=1 - should limit results', async () => {
      const res = await app.fetch(new Request('http://localhost/api/users?limit=1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.length).toBe(1);
    });

    it('GET /api/users/:id - should get user by id', async () => {
      const res = await app.fetch(new Request('http://localhost/api/users/1'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.id).toBe('1');
      expect(data.name).toBe('Alice');
    });

    it('POST /api/users - should create user', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Charlie' }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Charlie');
      expect(data.id).not.toBeUndefined();
    });

    it('PUT /api/users/:id - should update user', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/users/1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Alice Updated' }),
        })
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.name).toBe('Alice Updated');
    });
  });

  describe('Lambda Handler', () => {
    it('should create lambda handler', () => {
      const handler = app.lambdaHandler();
      expect(typeof handler).toBe('function');
    });

    it('should handle API Gateway v2 event', async () => {
      const handler = app.lambdaHandler();
      const event = {
        requestContext: { http: { method: 'GET', path: '/api/users' } },
        rawPath: '/api/users',
        rawQueryString: '',
        headers: { 'content-type': 'application/json' },
      };
      const context = {
        functionName: 'test',
        awsRequestId: '123',
        getRemainingTimeInMillis: () => 5000,
      };

      const response = await handler(event, context);
      expect(response.statusCode).toBe(200);
      expect(response.body).not.toBeUndefined();
    });
  });
});
