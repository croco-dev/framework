import "reflect-metadata";
import type { z } from "zod";
import { ConfigSchemaNotFoundProblem } from "../libs/problems/ConfigProblems";
import { validateConfig } from "../validateConfig";

const CONFIG_SCHEMA_KEY = Symbol("config:schema");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor = new (...args: any[]) => any;

export function ConfigSchema(schema: z.ZodType): (target: Constructor) => void {
  return (target: Constructor): void => {
    Reflect.defineMetadata(CONFIG_SCHEMA_KEY, schema, target);
  };
}

export function getConfigSchema(target: Constructor): z.ZodType | undefined {
  return Reflect.getMetadata(CONFIG_SCHEMA_KEY, target) as z.ZodType | undefined;
}

export function bootstrapConfig<T>(
  target: Constructor,
  env?: Record<string, string | undefined>,
): T {
  const schema = getConfigSchema(target);
  if (!schema) {
    throw new ConfigSchemaNotFoundProblem(target.name);
  }
  return validateConfig(schema, env) as T;
}
