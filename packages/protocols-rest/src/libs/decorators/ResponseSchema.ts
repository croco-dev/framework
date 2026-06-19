import "reflect-metadata";
import type { z } from "zod";
import { RESPONSE_SCHEMA_KEY } from "../constants";
import { isRouteContractSpec, type RouteContractSpec } from "../types/RouteContract";

export function ResponseSchema<TContract extends RouteContractSpec & { response: z.ZodType }>(
  contract: TContract,
): MethodDecorator;
export function ResponseSchema(schema: z.ZodType): MethodDecorator;
export function ResponseSchema(
  schemaOrContract: z.ZodType | (RouteContractSpec & { response: z.ZodType }),
): MethodDecorator {
  const schema = isRouteContractSpec(schemaOrContract)
    ? schemaOrContract.response
    : schemaOrContract;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, schema, target.constructor, propertyKey);

    return descriptor;
  };
}
