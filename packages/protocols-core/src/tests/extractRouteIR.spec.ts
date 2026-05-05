import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { extractRouteIR } from '../libs/extractRouteIR';
import { Body, Controller, Get, Param, Post, Query } from './helpers/test-decorators';

describe('extractRouteIR', () => {
  it('should extract a GET route with a path param', () => {
    @Controller('/users')
    class UsersController {
      @Get('/:id')
      getUser(@Param('id') _id: string): void {}
    }

    const routes = extractRouteIR(UsersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      controllerName: 'UsersController',
      methodName: 'getUser',
      httpMethod: 'GET',
      path: '/users/:id',
      domain: null,
      inputSchema: null,
      outputSchema: null,
    });
    expect(routes[0]?.params).toEqual([{ kind: 'path', name: 'id', schema: null }]);
  });

  it('should extract a POST route with body schema as input schema', () => {
    const createOrderSchema = z.object({ productId: z.string() });

    @Controller('/orders')
    class OrdersController {
      @Post('/')
      createOrder(@Body(createOrderSchema) _body: z.infer<typeof createOrderSchema>): void {}
    }

    const routes = extractRouteIR(OrdersController);

    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      controllerName: 'OrdersController',
      methodName: 'createOrder',
      httpMethod: 'POST',
      path: '/orders',
      domain: null,
      outputSchema: null,
    });
    expect(routes[0]?.inputSchema).toBe(createOrderSchema);
    expect(routes[0]?.params).toEqual([{ kind: 'body', name: '', schema: createOrderSchema }]);
  });

  it('should extract path and query params for a route', () => {
    @Controller('/items')
    class ItemsController {
      @Get('/:id')
      getItem(@Param('id') _id: string, @Query('filter') _filter: string): void {}
    }

    const routes = extractRouteIR(ItemsController);

    expect(routes).toHaveLength(1);
    expect(routes[0]?.params).toHaveLength(2);
    expect(routes[0]?.params).toEqual([
      { kind: 'path', name: 'id', schema: null },
      { kind: 'query', name: 'filter', schema: null },
    ]);
  });

  it('should return an empty array for a class without route metadata', () => {
    class PlainClass {}

    expect(extractRouteIR(PlainClass)).toEqual([]);
  });
});
