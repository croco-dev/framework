import "reflect-metadata";
import type { z } from "zod";
import { ConfigSchemaNotFoundProblem } from "../libs/problems/ConfigProblems";
import { validateConfig } from "../validateConfig";

const CONFIG_SCHEMA_KEY = Symbol("config:schema");

type Constructor = abstract new (...args: unknown[]) => unknown;

export function ConfigSchema(schema: z.ZodType): (target: Constructor) => void {
  return (target: Constructor): void => {
    Reflect.defineMetadata(CONFIG_SCHEMA_KEY, schema, target);
  };
}

export function getConfigSchema(target: Constructor): z.ZodType | undefined {
  const metadata: unknown = Reflect.getMetadata(CONFIG_SCHEMA_KEY, target);
  return metadata as z.ZodType | undefined;
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
