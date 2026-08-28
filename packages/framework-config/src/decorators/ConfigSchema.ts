import "reflect-metadata";
import type { z } from "zod";
import { ConfigSchemaNotFoundProblem } from "../libs/problems/ConfigProblems";
import { validateConfig } from "../validateConfig";

const CONFIG_SCHEMA_KEY = Symbol("config:schema");

type Constructor = abstract new (...args: unknown[]) => unknown;

export type ConfigDefinition<TSchema extends z.ZodType> = {
  readonly schema: TSchema;
};

export function defineConfig<const TSchema extends z.ZodType>(
  schema: TSchema,
): ConfigDefinition<TSchema> {
  return Object.freeze({ schema });
}

export function ConfigSchema(schema: z.ZodType): (target: Constructor) => void {
  return (target: Constructor): void => {
    Reflect.defineMetadata(CONFIG_SCHEMA_KEY, schema, target);
  };
}

export function getConfigSchema(target: Constructor): z.ZodType | undefined {
  const metadata: unknown = Reflect.getMetadata(CONFIG_SCHEMA_KEY, target);
  return metadata as z.ZodType | undefined;
}

export function bootstrapConfig<TSchema extends z.ZodType>(
  definition: ConfigDefinition<TSchema>,
  env?: Record<string, string | undefined>,
): z.output<TSchema>;

/**
 * @deprecated Use `defineConfig(schema)` and pass the returned definition to `bootstrapConfig`.
 */
export function bootstrapConfig(
  target: Constructor,
  env?: Record<string, string | undefined>,
): unknown;

export function bootstrapConfig(
  source: ConfigDefinition<z.ZodType> | Constructor,
  env?: Record<string, string | undefined>,
): unknown {
  if (typeof source !== "function") {
    return validateConfig(source.schema, env);
  }

  const schema = getConfigSchema(source);
  if (!schema) {
    throw new ConfigSchemaNotFoundProblem(source.name);
  }
  return validateConfig(schema, env);
}
