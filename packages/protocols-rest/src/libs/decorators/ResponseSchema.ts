import "reflect-metadata";
import type { z } from "zod";
import { RESPONSE_SCHEMA_KEY } from "../constants";
import { hasRouteResponseContract, type RouteContractWithResponse } from "../types/RouteContract";

export function ResponseSchema<TContract extends RouteContractWithResponse>(
  contract: TContract,
): MethodDecorator;
export function ResponseSchema(schema: z.ZodType): MethodDecorator;
export function ResponseSchema(
  schemaOrContract: z.ZodType | RouteContractWithResponse,
): MethodDecorator {
  const schema = hasRouteResponseContract(schemaOrContract)
    ? schemaOrContract.response
    : schemaOrContract;

  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    Reflect.defineMetadata(RESPONSE_SCHEMA_KEY, schema, target.constructor, propertyKey);

    return descriptor;
  };
}
