import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { REST_CONTROLLER_KEY } from '../../libs/constants';
import { Controller } from '../../libs/decorators/Controller';
import type { ControllerMetadata } from '../../libs/types';

describe('Controller decorator', () => {
  it('should define controller metadata with path', () => {
    @Controller('/users')
    class UserController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, UserController) as ControllerMetadata;
    expect(metadata).toBeDefined();
    expect(metadata?.path).toBe('/users');
    expect(metadata?.target).toBe(UserController);
  });

  it('should normalize path without leading slash', () => {
    @Controller('products')
    class ProductController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, ProductController) as ControllerMetadata;
    expect(metadata?.path).toBe('/products');
  });

  it('should normalize path with leading slash', () => {
    @Controller('/items')
    class ItemController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, ItemController) as ControllerMetadata;
    expect(metadata?.path).toBe('/items');
  });

  it('should handle empty path', () => {
    @Controller()
    class RootController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, RootController) as ControllerMetadata;
    expect(metadata?.path).toBe('');
  });

  it('should normalize root slash to empty string', () => {
    @Controller('/')
    class RootSlashController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, RootSlashController) as ControllerMetadata;
    expect(metadata?.path).toBe('');
  });

  it('should handle nested paths', () => {
    @Controller('/api/v1/users')
    class ApiV1UsersController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, ApiV1UsersController) as ControllerMetadata;
    expect(metadata?.path).toBe('/api/v1/users');
  });

  it('should store target reference', () => {
    @Controller('/test')
    class TestController {}

    const metadata = Reflect.getMetadata(REST_CONTROLLER_KEY, TestController) as ControllerMetadata;
    expect(metadata?.target).toBe(TestController);
  });

  it('should define metadata using Reflect.defineMetadata', () => {
    @Controller('/api')
    class ApiController {}

    const hasMetadata = Reflect.hasMetadata(REST_CONTROLLER_KEY, ApiController);
    expect(hasMetadata).toBe(true);
  });

  it('should preserve multiple controllers with different paths', () => {
    @Controller('/users')
    class UsersController {}

    @Controller('/posts')
    class PostsController {}

    const usersMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, UsersController) as ControllerMetadata;
    const postsMeta = Reflect.getMetadata(REST_CONTROLLER_KEY, PostsController) as ControllerMetadata;

    expect(usersMeta?.path).toBe('/users');
    expect(postsMeta?.path).toBe('/posts');
  });
});
