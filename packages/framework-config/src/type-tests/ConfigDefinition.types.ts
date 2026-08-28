import { z } from "zod";
import { bootstrapConfig, ConfigSchema, defineConfig } from "../decorators/ConfigSchema";
import { validateConfig } from "../validateConfig";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2
    ? true
    : false;
type Expect<Value extends true> = Value;

const definition = defineConfig(
  z.object({
    API_KEY: z.string(),
    PORT: z.string().transform(Number),
    TIMEOUT: z.coerce.number().default(5000),
  }),
);

const config = bootstrapConfig(definition, {
  API_KEY: "test-api-key",
  PORT: "3000",
});

type InferredConfig = Expect<
  Equal<
    typeof config,
    {
      API_KEY: string;
      PORT: number;
      TIMEOUT: number;
    }
  >
>;

const directlyValidated = validateConfig(definition.schema, {
  API_KEY: "test-api-key",
  PORT: "3000",
});
type DirectlyValidatedConfig = Expect<Equal<typeof directlyValidated, typeof config>>;

type WrongConfig = {
  API_KEY: number;
};

// @ts-expect-error callers cannot replace the schema output with an unrelated return type
bootstrapConfig<WrongConfig>(definition);

class LegacyConfig {}
ConfigSchema(z.object({ API_KEY: z.string() }))(LegacyConfig);

const legacyConfig = bootstrapConfig(LegacyConfig, { API_KEY: "test-api-key" });
type LegacyConfigIsUnknown = Expect<Equal<typeof legacyConfig, unknown>>;

// @ts-expect-error the deprecated class path does not accept a caller-defined return type
bootstrapConfig<LegacyConfig>(LegacyConfig);

export type { DirectlyValidatedConfig, InferredConfig, LegacyConfigIsUnknown };
