import 'reflect-metadata';
import { Container } from '@croco/framework-context';
import { Logger } from '@croco/framework-logger';
import { Controller, Get, Param, Post } from '@croco/protocols-rest';
import { beforeEach, describe, expect, it } from 'vitest';
import { RouteCompiler } from '../libs/RouteCompiler';

describe('RouteCompiler', () => {
  beforeEach(() => {
    Container.reset();
    Container.set(Logger, {
      info: () => {},
      warn: () => {},
      error: () => {},
      debug: () => {},
    } as unknown as Logger);
  });

  it('should compile routes from controller', () => {
    @Controller('/users')
    class UserController {
      @Get()
      list() {
        return [];
      }

      @Get('/:id')
      getById(@Param('id') id: string) {
        return { id };
      }

      @Post()
      create() {
        return { created: true };
      }
    }

    const compiler = new RouteCompiler();
    const routes = compiler.compile([UserController]);

    expect(routes).toHaveLength(3);
    expect(routes[0].path).toBe('/users');
    expect(routes[0].method).toBe('GET');
    expect(routes[1].path).toBe('/users/:id');
    expect(routes[2].method).toBe('POST');
  });

  it('should skip non-controller classes', () => {
    class NotAController {
      @Get()
      test() {}
    }

    const compiler = new RouteCompiler();
    const routes = compiler.compile([NotAController]);

    expect(routes).toHaveLength(0);
  });
});
