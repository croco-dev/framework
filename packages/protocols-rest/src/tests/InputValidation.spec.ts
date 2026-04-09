import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { REST_PARAMS_KEY } from '../libs/constants';
import { Controller } from '../libs/decorators/Controller';
import { Get, Post } from '../libs/decorators/HttpMethod';
import { Body, Param, Query } from '../libs/decorators/Params';
import type { ParamMetadata } from '../libs/types';

describe('Input Validation with Zod schema', () => {
  describe('@Body(schema) decorator', () => {
    it('should register body metadata with schema pipe', () => {
      const CreateUserSchema = z.object({
        name: z.string(),
        email: z.string().email(),
      });

      @Controller('/users')
      class UserController {
        @Post('/')
        create(@Body(CreateUserSchema) body: { name: string; email: string }) {
          return body;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('create') || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe('body');
      expect(params[0].index).toBe(0);
      expect(params[0].pipes).toBeDefined();
      expect(params[0].pipes?.length).toBe(1);
    });

    it('should support @Body() without schema (backward compatibility)', () => {
      @Controller('/users')
      class UserController {
        @Post('/')
        create(@Body() body: unknown) {
          return body;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('create') || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe('body');
      expect(params[0].pipes).toBeUndefined();
    });

    it('should support complex schema types', () => {
      const ComplexSchema = z.object({
        name: z.string().min(1).max(100),
        age: z.number().int().min(0).max(150),
        email: z.string().email(),
        tags: z.array(z.string()).optional(),
      });

      @Controller('/items')
      class ItemController {
        @Post('/')
        create(@Body(ComplexSchema) body: unknown) {
          return body;
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, ItemController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('create') || [];

      expect(params).toHaveLength(1);
      expect(params[0].pipes).toBeDefined();
      expect(params[0].pipes?.length).toBe(1);
    });
  });

  describe('@Param and @Query with validation', () => {
    it('should register param with schema validation', () => {
      const IdSchema = z.string().uuid();

      @Controller('/users/:id')
      class UserController {
        @Get('/')
        getById(@Param('id', IdSchema) id: string) {
          return { id };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('getById') || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe('param');
      expect(params[0].name).toBe('id');
      expect(params[0].pipes).toBeDefined();
      expect(params[0].pipes?.length).toBe(1);
    });

    it('should register query with schema validation', () => {
      const PageSchema = z.number().int().min(1).default(1);

      @Controller('/users')
      class UserController {
        @Get('/')
        list(@Query('page', PageSchema) page: number) {
          return { page };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('list') || [];

      expect(params).toHaveLength(1);
      expect(params[0].type).toBe('query');
      expect(params[0].name).toBe('page');
      expect(params[0].pipes).toBeDefined();
    });
  });

  describe('Mixed validation scenarios', () => {
    it('should support multiple validated parameters', () => {
      const IdSchema = z.string().uuid();
      const BodySchema = z.object({
        name: z.string().min(1),
      });

      @Controller('/users/:id')
      class UserController {
        @Post('/')
        update(@Param('id', IdSchema) id: string, @Body(BodySchema) body: { name: string }) {
          return { id, ...body };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, UserController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('update') || [];

      expect(params).toHaveLength(2);
      expect(params[0].pipes).toBeDefined();
      expect(params[1].pipes).toBeDefined();
    });

    it('should support combining @Param without schema and @Body with schema', () => {
      const BodySchema = z.object({
        title: z.string(),
      });

      @Controller('/posts/:id')
      class PostController {
        @Post('/')
        update(@Param('id') id: string, @Body(BodySchema) body: { title: string }) {
          return { id, ...body };
        }
      }

      const paramsMap = Reflect.getMetadata(REST_PARAMS_KEY, PostController) as Map<string | symbol, ParamMetadata[]>;
      const params = paramsMap.get('update') || [];

      expect(params).toHaveLength(2);
      expect(params[0].type).toBe('body');
      expect(params[0].pipes).toBeDefined();
      expect(params[1].name).toBe('id');
      expect(params[1].pipes).toBeUndefined();
    });
  });
});
