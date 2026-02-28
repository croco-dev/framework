import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import 'reflect-metadata';
import { z } from 'zod';
import { bootstrapConfig, ConfigSchema, getConfigSchema } from '../decorators/ConfigSchema';
import { ConfigValidationProblem } from '../libs/problems/ConfigProblems';
import { validateConfig } from '../validateConfig';

describe('validateConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = originalEnv;
  });

  describe('with valid config', () => {
    it('should return validated config when all required fields are present', () => {
      const schema = z.object({
        DATABASE_URL: z.string(),
        PORT: z.string().default('3000'),
      });

      const env = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
      };

      const result = validateConfig(schema, env);

      expect(result).toEqual({
        DATABASE_URL: 'postgresql://localhost:5432/test',
        PORT: '3000',
      });
    });

    it('should use process.env when env parameter is not provided', () => {
      const originalProcessEnv = process.env;
      process.env = { NODE_ENV: 'test', TEST_VAR: 'test-value' };

      const schema = z.object({
        TEST_VAR: z.string(),
      });

      const result = validateConfig(schema);

      expect(result).toEqual({ TEST_VAR: 'test-value' });
      process.env = originalProcessEnv;
    });

    it('should handle optional fields', () => {
      const schema = z.object({
        REQUIRED: z.string(),
        OPTIONAL: z.string().optional(),
      });

      const env = {
        REQUIRED: 'required-value',
      };

      const result = validateConfig(schema, env);

      expect(result).toEqual({
        REQUIRED: 'required-value',
        OPTIONAL: undefined,
      });
    });
  });

  describe('with invalid config', () => {
    it('should throw when required field is missing', () => {
      const schema = z.object({
        DATABASE_URL: z.string(),
        API_KEY: z.string(),
      });

      const env = {
        DATABASE_URL: 'postgresql://localhost:5432/test',
      };

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);
    });

    it('should log missing required fields', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const schema = z.object({
        MISSING_VAR: z.string(),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[CONFIG ERROR] Missing required: MISSING_VAR');
    });

    it('should handle multiple missing fields', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const schema = z.object({
        VAR1: z.string(),
        VAR2: z.string(),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[CONFIG ERROR] Missing required: VAR1, VAR2');
    });

    it('should handle nested path in error message', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const schema = z.object({
        DATABASE: z.object({
          URL: z.string(),
        }),
      });

      const env = {};

      expect(() => validateConfig(schema, env)).toThrow(ConfigValidationProblem);

      expect(consoleErrorSpy).toHaveBeenCalledWith('[CONFIG ERROR] Missing required: DATABASE');
    });
  });

  describe('type coercion', () => {
    it('should coerce string to number', () => {
      const schema = z.object({
        PORT: z.coerce.number(),
      });

      const env = {
        PORT: '3000',
      };

      const result = validateConfig(schema, env);

      expect(result.PORT).toBe(3000);
      expect(typeof result.PORT).toBe('number');
    });

    it('should handle enum values', () => {
      const schema = z.object({
        NODE_ENV: z.enum(['development', 'test', 'production']),
      });

      const env = {
        NODE_ENV: 'production',
      };

      const result = validateConfig(schema, env);

      expect(result.NODE_ENV).toBe('production');
    });
  });
});

describe('ConfigSchema decorator', () => {
  it('should store schema as metadata on class', () => {
    const schema = z.object({
      API_KEY: z.string(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    const storedSchema = getConfigSchema(AppConfig);
    expect(storedSchema).toBe(schema);
  });

  it('should return undefined for class without decorator', () => {
    class PlainConfig {}

    const storedSchema = getConfigSchema(PlainConfig);
    expect(storedSchema).toBeUndefined();
  });
});

describe('bootstrapConfig', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should validate and return config for decorated class', () => {
    const schema = z.object({
      API_KEY: z.string(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    const env = {
      API_KEY: 'test-api-key',
    };

    const result = bootstrapConfig(AppConfig, env);

    expect(result).toEqual({ API_KEY: 'test-api-key' });
  });

  it('should throw error for class without decorator', () => {
    class PlainConfig {}

    expect(() => bootstrapConfig(PlainConfig, {})).toThrow("No config schema found for 'PlainConfig'");
  });

  it('should throw when validation fails', () => {
    const schema = z.object({
      REQUIRED_VAR: z.string(),
    });

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    class AppConfig {}
    ConfigSchema(schema)(AppConfig);

    expect(() => bootstrapConfig(AppConfig, {})).toThrow(ConfigValidationProblem);
  });
});
