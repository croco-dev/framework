import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { HttpMethod } from '../libs/constants';
import { Controller } from '../libs/decorators/Controller';
import { Delete, Get, Post } from '../libs/decorators/HttpMethod';
import { getRouteMeta } from '../libs/metadata/MetadataReader';

describe('HttpMethod decorators', () => {
  it('should register GET route', () => {
    @Controller('/users')
    class UserController {
      @Get('/:id')
      getUser() {}
    }

    const routes = getRouteMeta(UserController);
    expect(routes).toHaveLength(1);
    expect(routes[0].method).toBe(HttpMethod.GET);
    expect(routes[0].path).toBe('/:id');
    expect(routes[0].methodName).toBe('getUser');
  });

  it('should register multiple routes', () => {
    @Controller('/items')
    class ItemController {
      @Get()
      list() {}

      @Post()
      create() {}

      @Delete('/:id')
      remove() {}
    }

    const routes = getRouteMeta(ItemController);
    expect(routes).toHaveLength(3);
  });
});
