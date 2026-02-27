import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { REST_FILTERS_KEY, REST_GUARDS_KEY, REST_INTERCEPTORS_KEY, REST_PIPES_KEY } from '../../libs/constants';
import { Controller } from '../../libs/decorators/Controller';
import { Get, Post } from '../../libs/decorators/HttpMethod';
import { UseFilters, UseGuards, UseInterceptors, UsePipes } from '../../libs/decorators/Lifecycle';
import type { CallHandler } from '../../libs/interfaces/CallHandler';
import type { ArgumentMetadata } from '../../libs/interfaces/PipeTransform';

class MockGuard {
  canActivate(): boolean {
    return true;
  }
}

class MockPipe {
  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    return value;
  }
}

class MockInterceptor {
  async intercept(_context: unknown, next: CallHandler): Promise<unknown> {
    return next.handle();
  }
}

class MockFilter {
  catch(_exception: unknown, _context: unknown): unknown {
    return undefined;
  }
}

describe('Middleware decorators', () => {
  describe('@UseGuards decorator', () => {
    it('should register guards at class level', () => {
      @Controller('/users')
      @UseGuards(MockGuard)
      class UserController {}

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController);
      expect(guards).not.toBeUndefined();
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(MockGuard);
    });

    it('should register multiple guards at class level', () => {
      @Controller('/users')
      @UseGuards(MockGuard, MockGuard)
      class UserController {}

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController);
      expect(guards).toHaveLength(2);
    });

    it('should register guards at method level', () => {
      @Controller('/users')
      class UserController {
        @Get()
        @UseGuards(MockGuard)
        list() {}
      }

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController, 'list');
      expect(guards).not.toBeUndefined();
      expect(guards).toHaveLength(1);
      expect(guards[0]).toBe(MockGuard);
    });

    it('should register guards at both class and method level', () => {
      @Controller('/users')
      @UseGuards(MockGuard)
      class UserController {
        @Get()
        @UseGuards(MockGuard)
        list() {}
      }

      const classGuards = Reflect.getMetadata(REST_GUARDS_KEY, UserController);
      const methodGuards = Reflect.getMetadata(REST_GUARDS_KEY, UserController, 'list');

      expect(classGuards).toHaveLength(1);
      expect(methodGuards).toHaveLength(1);
    });
  });

  describe('@UsePipes decorator', () => {
    it('should register pipes at class level', () => {
      @Controller('/users')
      @UsePipes(MockPipe)
      class UserController {}

      const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController);
      expect(pipes).not.toBeUndefined();
      expect(pipes).toHaveLength(1);
      expect(pipes[0]).toBe(MockPipe);
    });

    it('should register multiple pipes at class level', () => {
      @Controller('/users')
      @UsePipes(MockPipe, MockPipe)
      class UserController {}

      const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController);
      expect(pipes).toHaveLength(2);
    });

    it('should register pipes at method level', () => {
      @Controller('/users')
      class UserController {
        @Post()
        @UsePipes(MockPipe)
        create() {}
      }

      const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController, 'create');
      expect(pipes).not.toBeUndefined();
      expect(pipes).toHaveLength(1);
      expect(pipes[0]).toBe(MockPipe);
    });

    it('should register pipes at both class and method level', () => {
      @Controller('/users')
      @UsePipes(MockPipe)
      class UserController {
        @Post()
        @UsePipes(MockPipe)
        create() {}
      }

      const classPipes = Reflect.getMetadata(REST_PIPES_KEY, UserController);
      const methodPipes = Reflect.getMetadata(REST_PIPES_KEY, UserController, 'create');

      expect(classPipes).toHaveLength(1);
      expect(methodPipes).toHaveLength(1);
    });
  });

  describe('@UseInterceptors decorator', () => {
    it('should register interceptors at class level', () => {
      @Controller('/users')
      @UseInterceptors(MockInterceptor)
      class UserController {}

      const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController);
      expect(interceptors).not.toBeUndefined();
      expect(interceptors).toHaveLength(1);
      expect(interceptors[0]).toBe(MockInterceptor);
    });

    it('should register multiple interceptors at class level', () => {
      @Controller('/users')
      @UseInterceptors(MockInterceptor, MockInterceptor)
      class UserController {}

      const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController);
      expect(interceptors).toHaveLength(2);
    });

    it('should register interceptors at method level', () => {
      @Controller('/users')
      class UserController {
        @Get()
        @UseInterceptors(MockInterceptor)
        list() {}
      }

      const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController, 'list');
      expect(interceptors).not.toBeUndefined();
      expect(interceptors).toHaveLength(1);
      expect(interceptors[0]).toBe(MockInterceptor);
    });

    it('should register interceptors at both class and method level', () => {
      @Controller('/users')
      @UseInterceptors(MockInterceptor)
      class UserController {
        @Get()
        @UseInterceptors(MockInterceptor)
        list() {}
      }

      const classInterceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController);
      const methodInterceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController, 'list');

      expect(classInterceptors).toHaveLength(1);
      expect(methodInterceptors).toHaveLength(1);
    });
  });

  describe('@UseFilters decorator', () => {
    it('should register filters at class level', () => {
      @Controller('/users')
      @UseFilters(MockFilter)
      class UserController {}

      const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController);
      expect(filters).not.toBeUndefined();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toBe(MockFilter);
    });

    it('should register multiple filters at class level', () => {
      @Controller('/users')
      @UseFilters(MockFilter, MockFilter)
      class UserController {}

      const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController);
      expect(filters).toHaveLength(2);
    });

    it('should register filters at method level', () => {
      @Controller('/users')
      class UserController {
        @Get()
        @UseFilters(MockFilter)
        list() {}
      }

      const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController, 'list');
      expect(filters).not.toBeUndefined();
      expect(filters).toHaveLength(1);
      expect(filters[0]).toBe(MockFilter);
    });

    it('should register filters at both class and method level', () => {
      @Controller('/users')
      @UseFilters(MockFilter)
      class UserController {
        @Get()
        @UseFilters(MockFilter)
        list() {}
      }

      const classFilters = Reflect.getMetadata(REST_FILTERS_KEY, UserController);
      const methodFilters = Reflect.getMetadata(REST_FILTERS_KEY, UserController, 'list');

      expect(classFilters).toHaveLength(1);
      expect(methodFilters).toHaveLength(1);
    });
  });

  describe('Combined middleware decorators', () => {
    it('should register all middleware types at class level', () => {
      @Controller('/users')
      @UseGuards(MockGuard)
      @UsePipes(MockPipe)
      @UseInterceptors(MockInterceptor)
      @UseFilters(MockFilter)
      class UserController {}

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController);
      const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController);
      const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController);
      const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController);

      expect(guards).toHaveLength(1);
      expect(pipes).toHaveLength(1);
      expect(interceptors).toHaveLength(1);
      expect(filters).toHaveLength(1);
    });

    it('should register all middleware types at method level', () => {
      @Controller('/users')
      class UserController {
        @Get()
        @UseGuards(MockGuard)
        @UsePipes(MockPipe)
        @UseInterceptors(MockInterceptor)
        @UseFilters(MockFilter)
        list() {}
      }

      const guards = Reflect.getMetadata(REST_GUARDS_KEY, UserController, 'list');
      const pipes = Reflect.getMetadata(REST_PIPES_KEY, UserController, 'list');
      const interceptors = Reflect.getMetadata(REST_INTERCEPTORS_KEY, UserController, 'list');
      const filters = Reflect.getMetadata(REST_FILTERS_KEY, UserController, 'list');

      expect(guards).toHaveLength(1);
      expect(pipes).toHaveLength(1);
      expect(interceptors).toHaveLength(1);
      expect(filters).toHaveLength(1);
    });
  });
});
