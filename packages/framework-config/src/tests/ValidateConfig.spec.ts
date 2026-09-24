import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "reflect-metadata";
import { z } from "zod";
import {
  bootstrapConfig,
  ConfigSchema,
  defineConfig,
  getConfigSchema,
} from "../decorators/ConfigSchema";
import { ConfigValidationProblem } from "../libs/problems/ConfigProblems";
import { validateConfig } from "../validateConfig";

describe("validateConfig", () => {
  const originalEnv = process.env;

  beforeEach(() => {});

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe("with valid config", () => {
    it("should return validated config when all required fields are present", () => {
      const schema = z.object({
        DATABASE_URL: z.string(),
        PORT: z.string().default("3000"),
      });

      const env = {
        DATABASE_URL: "postgresql://localhost:5432/test",
      };

      const result = validateConfig(schema, env);

      expect(result).toEqual({
        DATABASE_URL: "postgresql://localhost:5432/test",
        PORT: "3000",
      });
    });

    it("should use process.env when env parameter is not provided", () => {
      const originalProcessEnv = process.env;
      process.env = { NODE_ENV: "test", TEST_VAR: "test-value" };

      const schema = z.object({
        TEST_VAR: z.string(),
      });

      const result = validateConfig(schema);

      expect(result).toEqual({ TEST_VAR: "test-value" });
      process.env = originalProcessEnv;
    });

    it("should handle optional fields", () => {
      const schema = z.object({
        REQUIRED: z.string(),
        OPTIONAL: z.string().optional(),
      });

      const env = {
        REQUIRED: "required-value",
      };

      const result = validateConfig(schema, env);

      expect(result).toEqual({
        REQUIRED: "required-value",
        OPTIONAL: undefined,
      });
    });
  });

  describe("with invalid config", () => {
    it("should distinguish missing values from invalid values without exposing inputs", () => {
      const schema = z.object({
        MISSING: z.string(),
        PORT: z.coerce.number(),
        API_URL: z.url(),
        MODE: z.enum(["development", "production"]),
      });
      const env = {
        PORT: "secret-port-value",
        API_URL: "secret-url-value",
        MODE: "secret-mode-value",
      };

      let problem: ConfigValidationProblem | undefined;
      try {
        validateConfig(schema, env);
      } catch (error) {
        if (error instanceof ConfigValidationProblem) problem = error;
      }

      expect(problem).toBeInstanceOf(ConfigValidationProblem);
      expect(problem?.detail).toContain("MISSING: Missing required");
      expect(problem?.detail).toContain("PORT: invalid_type: Expected number");
      expect(problem?.detail).toContain("API_URL: invalid_format: Invalid URL");
      expect(problem?.detail).toContain("MODE: invalid_value: Invalid option");
      expect(problem?.detail).not.toContain("secret-");
    });

    it("should report a missing coerced value as missing", () => {
      const schema = z.object({ PORT: z.coerce.number() });

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should distinguish missing and invalid values through a wrapped object schema", () => {
      const schema = z.object({ PORT: z.coerce.number() }).transform((value) => value);

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
      expect(() => validateConfig(schema, { PORT: "abc" })).toThrow(
        "PORT: invalid_type: Expected number",
      );
    });

    it("should distinguish missing and invalid values through an intersection", () => {
      const schema = z.intersection(
        z.object({ PORT: z.coerce.number() }),
        z.object({ MODE: z.string().default("development") }),
      );

      expect(() => validateConfig(schema, {})).toThrow("<root>: Missing required");
      expect(() => validateConfig(schema, { PORT: "abc" })).toThrow(
        "<root>: invalid_type: Expected number",
      );
    });

    it("should not call an invalid transformed child missing when its source is present", () => {
      const schema = z.object({
        CONFIG: z
          .string()
          .transform((value) => ({ PORT: value }))
          .pipe(z.object({ PORT: z.number() })),
      });

      expect(() => validateConfig(schema, { CONFIG: "abc" })).toThrow(
        "CONFIG: invalid_type: Expected number",
      );
    });

    it("should not call a supplied value missing after a top-level transform renames it", () => {
      const schema = z
        .object({ RAW_PORT: z.string() })
        .transform(({ RAW_PORT }) => ({ PORT: RAW_PORT }))
        .pipe(z.object({ PORT: z.coerce.number() }));

      expect(() => validateConfig(schema, { RAW_PORT: "abc" })).toThrow(
        "PORT: invalid_type: Expected number",
      );
    });

    it("should not infer a missing piped field from the pre-transform input", () => {
      const schema = z
        .object({ RAW_PORT: z.string().optional() })
        .transform(({ RAW_PORT }) => ({ PORT: RAW_PORT ?? "abc" }))
        .pipe(z.object({ PORT: z.coerce.number() }));

      expect(() => validateConfig(schema, {})).toThrow("PORT: invalid_type: Expected number");
    });

    it("should classify piped output against its stage through a schema wrapper", () => {
      const schema = z
        .object({ RAW_PORT: z.string() })
        .transform(({ RAW_PORT }) => ({ PORT: RAW_PORT }))
        .pipe(z.object({ PORT: z.coerce.number() }))
        .optional();

      expect(() => validateConfig(schema, { RAW_PORT: "abc" })).toThrow(
        "PORT: invalid_type: Expected number",
      );
    });

    it("should not call a defaulted piped value missing", () => {
      const schema = z
        .object({ PORT: z.string().default("abc") })
        .pipe(z.object({ PORT: z.coerce.number() }));

      expect(() => validateConfig(schema, {})).toThrow("PORT: invalid_type: Expected number");
    });

    it("should report an input-stage missing value before a pipe runs", () => {
      const schema = z.object({ PORT: z.string() }).pipe(z.object({ PORT: z.coerce.number() }));

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should report an input-stage missing coerced value before a pipe runs", () => {
      const schema = z.object({ PORT: z.coerce.number() }).pipe(z.object({ PORT: z.number() }));

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should retain transformed issue provenance through an intersection", () => {
      const transformedPort = z
        .object({ RAW_PORT: z.string() })
        .transform(({ RAW_PORT }) => ({ PORT: RAW_PORT }))
        .pipe(z.object({ PORT: z.coerce.number() }));
      const schema = z.intersection(transformedPort, z.object({ MODE: z.string().optional() }));

      expect(() => validateConfig(schema, { RAW_PORT: "abc" })).toThrow(
        "<root>: invalid_type: Expected number",
      );
    });

    it("should report a missing field when its schema overrides the error message", () => {
      const schema = z.object({ PORT: z.string({ error: "Port is required" }) });

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should report a missing nested object", () => {
      const schema = z.object({ DATABASE: z.object({ URL: z.string() }) });

      expect(() => validateConfig(schema, {})).toThrow("DATABASE: Missing required");
    });

    it("should report a missing field before its transform or pipe runs", () => {
      const schema = z.object({
        PORT: z.coerce.number().pipe(z.number().positive()),
      });

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should not confuse a reused output validator with an optional input validator", () => {
      const port = z.coerce.number();
      const schema = z
        .object({ PORT: port.optional() })
        .transform(() => ({ PORT: "abc" }))
        .pipe(z.object({ PORT: port }));

      expect(() => validateConfig(schema, {})).toThrow("PORT: invalid_type: Expected number");
    });

    it("should report a missing field behind a lazy schema", () => {
      const schema = z.object({ PORT: z.lazy(() => z.coerce.number()) });

      expect(() => validateConfig(schema, {})).toThrow("PORT: Missing required");
    });

    it("should exclude custom issue paths and type labels derived from input", () => {
      const schema = z.object({
        TOKEN: z.string().superRefine((value, context) => {
          context.addIssue({ code: "invalid_type", expected: value, path: [value] });
        }),
      });

      let problem: ConfigValidationProblem | undefined;
      try {
        validateConfig(schema, { TOKEN: "secret-token-value" });
      } catch (error) {
        if (error instanceof ConfigValidationProblem) problem = error;
      }

      expect(problem?.detail).toContain("TOKEN: invalid_type: Invalid type");
      expect(problem?.detail).not.toContain("secret-token-value");
    });

    it("should not expose a custom validation message containing the input", () => {
      const schema = z.object({
        TOKEN: z.string().refine(() => false, { message: "Secret is secret-token-value" }),
      });

      expect(() => validateConfig(schema, { TOKEN: "secret-token-value" })).toThrow(
        "TOKEN: custom: Invalid value",
      );
      expect(() => validateConfig(schema, { TOKEN: "secret-token-value" })).not.toThrow(
        "secret-token-value",
      );
    });

    it("should throw when required field is missing", () => {
      const schema = z.object({
        DATABASE_URL: z.string(),
        API_KEY: z.string(),
      });

      const env = {
        DATABASE_URL: "postgresql://localhost:5432/test",
      };

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);
    });

    it("should throw when a single required field is missing", () => {
      const schema = z.object({
        MISSING_VAR: z.string(),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);
    });

    it("should handle multiple missing fields", () => {
      const schema = z.object({
        VAR1: z.string(),
        VAR2: z.string(),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);
    });

    it("should handle nested path in error message", () => {
      const schema = z.object({
        DATABASE: z.object({
          URL: z.string(),
        }),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);
    });
  });

  describe("type coercion", () => {
    it("should coerce string to number", () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      });

      const env = {
        PORT: "3000",
      };

      const result = validateConfig(schema, env);

      expect(result.PORT).toBe(3000);
      expect(typeof result.PORT).toBe("number");
    });

    it("should handle enum values", () => {
      const schema = z.object({
        NODE_ENV: z.enum(["development", "test", "production"]),
      });

      const env = {
        NODE_ENV: "production",
      };

      const result = validateConfig(schema, env);

      expect(result.NODE_ENV).toBe("production");
    });
  });
});

describe("ConfigSchema decorator", () => {
  it("should store schema as metadata on class", () => {
    const schema = z.object({
      API_KEY: z.string(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    const storedSchema = getConfigSchema(AppConfig);
    expect(storedSchema).toBe(schema);
  });

  it("should return undefined for class without decorator", () => {
    class PlainConfig {}

    const storedSchema = getConfigSchema(PlainConfig);
    expect(storedSchema).toBeUndefined();
  });
});

describe("bootstrapConfig", () => {
  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should validate a typed config definition", () => {
    const schema = z.object({
      API_KEY: z.string(),
    });
    const definition = defineConfig(schema);

    const env = {
      API_KEY: "test-api-key",
    };

    const result = bootstrapConfig(definition, env);

    expect(result).toEqual({ API_KEY: "test-api-key" });
  });

  it("should preserve transformed output and defaults", () => {
    const schema = z.object({
      API_KEY: z.string(),
      TIMEOUT: z.string().transform(Number).default(5000),
    });
    const definition = defineConfig(schema);

    const config = bootstrapConfig(definition, {
      API_KEY: "sk_test",
      TIMEOUT: "3000",
    });
    expect(config).toEqual({ API_KEY: "sk_test", TIMEOUT: 3000 });
  });

  it("should apply default value when optional coerce field is missing", () => {
    const schema = z.object({
      API_KEY: z.string(),
      TIMEOUT: z.coerce.number().default(5000),
    });

    const definition = defineConfig(schema);

    const config = bootstrapConfig(definition, {
      API_KEY: "sk_test",
    });
    expect(config).toEqual({ API_KEY: "sk_test", TIMEOUT: 5000 });
  });

  it("should throw error for class without decorator", () => {
    class PlainConfig {}

    expect(() => bootstrapConfig(PlainConfig, {})).toThrow(
      "No config schema found for 'PlainConfig'",
    );
  });

  it("should keep decorated classes available as a deprecated runtime path", () => {
    const schema = z.object({
      API_KEY: z.string(),
    });

    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    expect(bootstrapConfig(AppConfig, { API_KEY: "test-api-key" })).toEqual({
      API_KEY: "test-api-key",
    });
  });

  it("should throw when validation fails", () => {
    const schema = z.object({
      REQUIRED_VAR: z.string(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    expect(() => bootstrapConfig(AppConfig, {})).toThrow(ConfigValidationProblem);
  });
});
