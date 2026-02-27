import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { Controller } from '../libs/decorators/Controller';
import { getControllerMeta } from '../libs/metadata/MetadataReader';

describe('Controller decorator', () => {
  it('should define controller metadata with path', () => {
    @Controller('/users')
    class UserController {}

    const meta = getControllerMeta(UserController);
    expect(meta).not.toBeUndefined();
    expect(meta?.path).toBe('/users');
  });

  it('should normalize path without leading slash', () => {
    @Controller('products')
    class ProductController {}

    const meta = getControllerMeta(ProductController);
    expect(meta?.path).toBe('/products');
  });

  it('should handle empty path', () => {
    @Controller()
    class RootController {}

    const meta = getControllerMeta(RootController);
    expect(meta?.path).toBe('');
  });
});
