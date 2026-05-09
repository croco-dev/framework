import 'reflect-metadata';
import type { z } from 'zod';
import { RESPONSE_SCHEMA_KEY } from '../constants';

export function ResponseSchema(schema: z.ZodType): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, schema, target.constructor, propertyKey);

    return descriptor;
  };
}
