import { z } from "zod";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { DefineRuntimeEnvOptions, RuntimeEnvPreset } from "../core";

import { InvalidBooleanEnvProblem } from "../libs/problems/ConfigProblems";

const DEFAULT_ENV = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_NAME: "Croco",
  NEXT_PUBLIC_APP_URL: "https://example.com",
} satisfies Record<string, string>;

async function importCoreWithEnv(
  skipValue: string | undefined,
  options: { omitRequiredServices?: boolean; preserveProcessEnvIdentity?: boolean } = {},
) {
  vi.resetModules();

  if (options.preserveProcessEnvIdentity) {
    Object.assign(process.env, DEFAULT_ENV);
  } else {
    process.env = {
      ...process.env,
      ...DEFAULT_ENV,
    };
  }

  if (options.omitRequiredServices) {
    delete process.env.DATABASE_URL;
    delete process.env.REDIS_URL;
  }

  if (skipValue === undefined) {
    delete process.env.SKIP_ENV_VALIDATION;
  } else {
    process.env.SKIP_ENV_VALIDATION = skipValue;
  }

  return import("../index");
}

describe("framework-config core skipValidation parser", () => {
  const originalEnv = process.env;
  const originalEnvValues = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
    for (const property of Object.keys(process.env)) {
      delete process.env[property];
    }
    Object.assign(process.env, originalEnvValues);
    vi.resetModules();
  });

  it.each(["true", "1", "yes"])("enables skipValidation for %s", async (value) => {
    const core = await importCoreWithEnv(value, { omitRequiredServices: true });

    expect(core.fullEnv.DATABASE_URL).toBeUndefined();
  });

  it.each(["false", "0", "no"])("treats %s as disabled skipValidation", async (value) => {
    const core = await importCoreWithEnv(value, { omitRequiredServices: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => core.fullEnv.NODE_ENV).toThrow(
        expect.objectContaining({ code: "framework-config/config-validation-failed" }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("treats missing SKIP_ENV_VALIDATION as disabled", async () => {
    const core = await importCoreWithEnv(undefined);

    expect(core.env.NODE_ENV).toBe("test");
  });

  it("defers service environment validation until the exported env is read", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => core.fullEnv.NODE_ENV).toThrow(
        expect.objectContaining({ code: "framework-config/config-validation-failed" }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("reads SKIP_ENV_VALIDATION on first env access", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });

    process.env.SKIP_ENV_VALIDATION = "true";

    expect(core.fullEnv.DATABASE_URL).toBeUndefined();
  });

  it("preserves server-only environment access failures on the client", async () => {
    const core = await importCoreWithEnv(undefined);
    Reflect.set(globalThis, "window", {});

    try {
      expect(() => core.fullEnv.DATABASE_URL).toThrow(
        "Attempted to access a server-side environment variable on the client",
      );
    } finally {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  it("keeps object operations coherent after lazy initialization", async () => {
    const core = await importCoreWithEnv(undefined);

    expect(Reflect.set(core.env, "NODE_ENV", "production")).toBe(true);
    expect(core.env.NODE_ENV).toBe("production");
    expect(() => Object.preventExtensions(core.env)).not.toThrow();
    expect(Object.keys(core.env)).not.toContain("DATABASE_URL");
  });

  it("keeps reflected values synchronized when validation is skipped", async () => {
    const core = await importCoreWithEnv("true", { preserveProcessEnvIdentity: true });

    expect(Reflect.set(core.env, "PORT", 4000)).toBe(true);
    expect(core.env.PORT).toBe(4000);
    expect(Object.getOwnPropertyDescriptor(core.env, "PORT")?.value).toBe(core.env.PORT);

    process.env.PORT = "5000";

    expect(core.env.PORT).toBe(4000);
    expect(Object.getOwnPropertyDescriptor(core.env, "PORT")?.value).toBe(core.env.PORT);
    expect(process.env.PORT).toBe("5000");
  });

  it("rejects invalid SKIP_ENV_VALIDATION values on first env access", async () => {
    const core = await importCoreWithEnv("banana");

    expect(() => core.env.NODE_ENV).toThrow(
      expect.objectContaining({
        code: "framework-config/invalid-boolean-env",
        detail: "Invalid boolean env value for 'SKIP_ENV_VALIDATION': 'banana'",
      }),
    );
  });
});

describe("framework-config runtime env preset composition", () => {
  const originalEnv = process.env;
  const originalEnvValues = { ...process.env };

  afterEach(() => {
    process.env = originalEnv;
    for (const property of Object.keys(process.env)) {
      delete process.env[property];
    }
    Object.assign(process.env, originalEnvValues);
    Reflect.deleteProperty(globalThis, "window");
    vi.resetModules();
  });

  it("validates the default app env without integration variables", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });

    expect(core.env.NODE_ENV).toBe("test");
    expect("DATABASE_URL" in core.env).toBe(false);
    expect("REDIS_URL" in core.env).toBe(false);
  });

  it("fails explicitly when a selected database preset is missing DATABASE_URL", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() =>
        core.defineRuntimeEnv({ presets: [core.appConfig, core.databaseConfig] }),
      ).toThrow(expect.objectContaining({ code: "framework-config/config-validation-failed" }));
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it.each([undefined, ""])(
    "reports a missing preset value %s without console output",
    async (value) => {
      const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
      if (value !== undefined) process.env.DATABASE_URL = value;
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        expect(() => core.defineRuntimeEnv({ presets: [core.databaseConfig] })).toThrow(
          expect.objectContaining({
            code: "framework-config/config-validation-failed",
            detail: "Config validation failed: DATABASE_URL: Missing required",
          }),
        );
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it.each(["PORT", "NODE_ENV"])(
    "reports invalid %s safely through direct and lazy paths",
    async (key) => {
      const core = await importCoreWithEnv(undefined);
      process.env[key] = "not-a-port";
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        for (const run of [
          () => core.defineRuntimeEnv({ presets: [core.appConfig] }),
          () => core.env.NODE_ENV,
          () => core.fullEnv.NODE_ENV,
        ]) {
          let failure: unknown;
          try {
            run();
          } catch (error) {
            failure = error;
          }
          expect(failure).toBeInstanceOf(core.ConfigValidationProblem);
          expect(failure).toMatchObject({
            code: "framework-config/config-validation-failed",
            detail: expect.stringContaining(`${key}: invalid_`),
          });
          expect((failure as { detail: string }).detail).not.toMatch(/Missing required|not-a-port/);
        }
        expect(consoleError).not.toHaveBeenCalled();
      } finally {
        consoleError.mockRestore();
      }
    },
  );

  it("redacts code-less Standard Schema messages and nested paths", async () => {
    const core = await importCoreWithEnv(undefined);
    process.env.SECRET = "sensitive-value";
    expect(() =>
      core.defineRuntimeEnv({
        presets: [
          {
            server: {
              SECRET: {
                "~standard": {
                  version: 1,
                  vendor: "test",
                  validate: () => ({
                    issues: [{ message: "sensitive-value", path: [{ key: "sensitive-value" }] }],
                  }),
                },
              },
            },
            client: {},
            shared: {},
          },
        ],
      }),
    ).toThrow(
      expect.objectContaining({
        detail: "Config validation failed: SECRET: invalid_value: Invalid value",
      }),
    );
  });

  it("narrows the result type to the selected presets", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    process.env.DATABASE_URL = "https://database.example.com";

    const appEnv = core.defineRuntimeEnv({ presets: [core.appConfig] });
    const databaseEnv = core.defineRuntimeEnv({ presets: [core.appConfig, core.databaseConfig] });

    expectTypeOf(appEnv).toEqualTypeOf<
      Readonly<{
        NODE_ENV: "development" | "test" | "production";
        PORT: number;
        LOG_LEVEL: "debug" | "info" | "warn" | "error";
      }>
    >();
    expectTypeOf(databaseEnv).toEqualTypeOf<
      Readonly<{
        NODE_ENV: "development" | "test" | "production";
        PORT: number;
        LOG_LEVEL: "debug" | "info" | "warn" | "error";
        DATABASE_URL: string;
      }>
    >();
    expect(appEnv).not.toHaveProperty("DATABASE_URL");
    expect(databaseEnv.DATABASE_URL).toBe("https://database.example.com");
  });

  it("preserves server, client, and shared exposure boundaries after composition", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    process.env.SERVER_SECRET = "secret";
    process.env.NEXT_PUBLIC_LABEL = "public";
    process.env.DEPLOYMENT_REGION = "local";
    Reflect.set(globalThis, "window", {});

    const composedEnv = core.defineRuntimeEnv({
      presets: [
        {
          server: { SERVER_SECRET: z.string() },
          client: { NEXT_PUBLIC_LABEL: z.string() },
          shared: { DEPLOYMENT_REGION: z.string() },
        },
      ],
    });

    expectTypeOf(composedEnv).toEqualTypeOf<
      Readonly<{
        SERVER_SECRET: string;
        NEXT_PUBLIC_LABEL: string;
        DEPLOYMENT_REGION: string;
      }>
    >();
    expect(composedEnv.NEXT_PUBLIC_LABEL).toBe("public");
    expect(composedEnv.DEPLOYMENT_REGION).toBe("local");
    expect(() => composedEnv.SERVER_SECRET).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );

    const annotatedPreset: RuntimeEnvPreset = {
      server: { SERVER_SECRET: z.string() },
      client: { NEXT_PUBLIC_LABEL: z.string() },
      shared: { DEPLOYMENT_REGION: z.string() },
    };
    expect(() => core.defineRuntimeEnv({ presets: [annotatedPreset] })).not.toThrow();

    const invalidAnnotatedPreset: RuntimeEnvPreset = {
      server: { NEXT_PUBLIC_SECRET: z.string() },
      client: {},
      shared: {},
    };
    expect(() => core.defineRuntimeEnv({ presets: [invalidAnnotatedPreset] })).toThrow(
      expect.objectContaining({
        code: "framework-config/runtime-env-preset-boundary",
        detail:
          "Invalid server env 'NEXT_PUBLIC_SECRET': server variables cannot use the 'NEXT_PUBLIC_' prefix",
      }),
    );

    const invalidAnnotatedClientPreset: RuntimeEnvPreset = {
      server: {},
      client: { PUBLIC_LABEL: z.string() },
      shared: {},
    };
    expect(() => core.defineRuntimeEnv({ presets: [invalidAnnotatedClientPreset] })).toThrow(
      "client variables must use the 'NEXT_PUBLIC_' prefix",
    );

    const assertInvalidBoundaryTypes = (): void => {
      core.defineRuntimeEnv({
        // @ts-expect-error server variables cannot use the public client prefix
        presets: [{ server: { NEXT_PUBLIC_SECRET: z.string() }, client: {}, shared: {} }],
      });
      core.defineRuntimeEnv({
        // @ts-expect-error client variables must use the public client prefix
        presets: [{ server: {}, client: { PUBLIC_LABEL: z.string() }, shared: {} }],
      });

      const widenedPresets = [core.appConfig, core.databaseConfig];
      core.defineRuntimeEnv({
        // @ts-expect-error widened arrays lose preset order and cannot preserve last-wins typing
        presets: widenedPresets,
      });

      const overlappingWidenedPresets = [
        { server: { DUPLICATE: z.string() }, client: {}, shared: {} },
        { server: { DUPLICATE: z.coerce.number() }, client: {}, shared: {} },
      ];
      core.defineRuntimeEnv({
        // @ts-expect-error widened arrays cannot soundly type overlapping last-wins keys
        presets: overlappingWidenedPresets,
      });
    };
    expectTypeOf(assertInvalidBoundaryTypes).toBeFunction();
  });

  it("uses the configured client prefix for validation and client exposure", async () => {
    const core = await importCoreWithEnv(undefined);
    process.env.VITE_API_URL = "https://api.example.com";
    process.env.SERVER_SECRET = "secret";
    Reflect.set(globalThis, "window", {});

    const runtimeEnv = core.defineRuntimeEnv({
      clientPrefix: "VITE_",
      presets: [
        { server: { SERVER_SECRET: z.string() }, client: { VITE_API_URL: z.url() }, shared: {} },
      ],
    });

    expectTypeOf(runtimeEnv).toEqualTypeOf<
      Readonly<{ SERVER_SECRET: string; VITE_API_URL: string }>
    >();
    expect(runtimeEnv.VITE_API_URL).toBe("https://api.example.com");
    expect(() => runtimeEnv.SERVER_SECRET).toThrow(
      "Attempted to access a server-side environment variable on the client",
    );
  });

  it("accepts a widened client prefix while preserving inferred schema output", async () => {
    const core = await importCoreWithEnv(undefined);
    const config = { envPrefix: "VITE_" };
    process.env.SERVER_PORT = "3000";
    process.env.VITE_API_URL = "https://api.example.com";

    expectTypeOf(config.envPrefix).toEqualTypeOf<string>();
    const runtimeEnv = core.defineRuntimeEnv({
      clientPrefix: config.envPrefix,
      presets: [
        {
          server: { SERVER_PORT: z.coerce.number() },
          client: { VITE_API_URL: z.url() },
          shared: {},
        },
      ],
    });

    expectTypeOf(runtimeEnv).toEqualTypeOf<
      Readonly<{ SERVER_PORT: number; VITE_API_URL: string }>
    >();
    expect(runtimeEnv.SERVER_PORT).toBe(3000);
    expect(runtimeEnv.VITE_API_URL).toBe("https://api.example.com");
  });

  it.each([undefined, "true"])(
    "checks widened prefix boundaries with skipValidation=%s",
    async (skip) => {
      const core = await importCoreWithEnv(skip);
      const config = { envPrefix: "VITE_" };

      expect(() =>
        core.defineRuntimeEnv({
          clientPrefix: config.envPrefix,
          presets: [{ server: { VITE_SECRET: z.string() }, client: {}, shared: {} }],
        }),
      ).toThrow("server variables cannot use the 'VITE_' prefix");
      expect(() =>
        core.defineRuntimeEnv({
          clientPrefix: config.envPrefix,
          presets: [{ server: {}, client: { NEXT_PUBLIC_LABEL: z.string() }, shared: {} }],
        }),
      ).toThrow("client variables must use the 'VITE_' prefix");
    },
  );

  it.each([undefined, "true"])(
    "checks configured prefix boundaries with skipValidation=%s",
    async (skip) => {
      const core = await importCoreWithEnv(skip);
      const serverPreset: RuntimeEnvPreset = {
        server: { VITE_SECRET: z.string() },
        client: {},
        shared: {},
      };
      const clientPreset: RuntimeEnvPreset = {
        server: {},
        client: { NEXT_PUBLIC_LABEL: z.string() },
        shared: {},
      };

      expect(() =>
        core.defineRuntimeEnv({ clientPrefix: "VITE_", presets: [serverPreset] }),
      ).toThrow("server variables cannot use the 'VITE_' prefix");
      expect(() =>
        core.defineRuntimeEnv({ clientPrefix: "VITE_", presets: [clientPreset] }),
      ).toThrow("client variables must use the 'VITE_' prefix");

      const assertInvalidPrefixTypes = (): void => {
        core.defineRuntimeEnv({
          clientPrefix: "VITE_",
          // @ts-expect-error the configured public prefix cannot appear in the server section
          presets: [{ server: { VITE_SECRET: z.string() }, client: {}, shared: {} }],
        });
        core.defineRuntimeEnv({
          clientPrefix: "VITE_",
          // @ts-expect-error client keys must use the configured prefix, even if they use the default prefix
          presets: [{ server: {}, client: { NEXT_PUBLIC_LABEL: z.string() }, shared: {} }],
        });
        core.defineRuntimeEnv({
          // @ts-expect-error without an option, Vite keys do not match the default prefix
          presets: [{ server: {}, client: { VITE_LABEL: z.string() }, shared: {} }],
        });
      };
      expectTypeOf<{ presets: readonly [RuntimeEnvPreset] }>().not.toExtend<
        DefineRuntimeEnvOptions<readonly [RuntimeEnvPreset], "VITE_">
      >();
      expectTypeOf(assertInvalidPrefixTypes).toBeFunction();
    },
  );

  it("rejects an empty client prefix even when schema validation is skipped", async () => {
    const core = await importCoreWithEnv("true");
    const clientPrefix: string = "";
    expect(() =>
      core.defineRuntimeEnv({ clientPrefix, presets: [{ server: {}, client: {}, shared: {} }] }),
    ).toThrow("clientPrefix must not be empty");
    const assertEmptyPrefixType = (): void => {
      core.defineRuntimeEnv({
        // @ts-expect-error an empty literal cannot provide a client exposure prefix
        clientPrefix: "",
        presets: [{ server: {}, client: {}, shared: {} }],
      });
    };
    expectTypeOf(assertEmptyPrefixType).toBeFunction();
  });

  it("supports custom bundler prefixes and last-wins client schema inference", async () => {
    const core = await importCoreWithEnv(undefined);
    process.env.PUBLIC_PORT = "8080";
    const runtimeEnv = core.defineRuntimeEnv({
      clientPrefix: "PUBLIC_",
      presets: [
        { server: {}, client: { PUBLIC_PORT: z.string() }, shared: {} },
        { server: {}, client: { PUBLIC_PORT: z.coerce.number() }, shared: {} },
      ],
    });
    expectTypeOf(runtimeEnv).toEqualTypeOf<Readonly<{ PUBLIC_PORT: number }>>();
    expect(runtimeEnv.PUBLIC_PORT).toBe(8080);
  });

  it("keeps the previous all-presets behavior behind explicit exports", async () => {
    const core = await importCoreWithEnv(undefined);

    expect(core.fullRuntimeEnvPresets).toEqual([
      core.appConfig,
      core.databaseConfig,
      core.redisConfig,
      core.storageConfig,
    ]);
    expect(core.fullEnv.DATABASE_URL).toBe("postgresql://localhost:5432/test");
    expect("DATABASE_URL" in core.fullEnv).toBe(true);
  });

  it("does not delete empty-string entries from process.env during validation", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    process.env.EMPTY_FLAG = "";

    const composedEnv = core.defineRuntimeEnv({
      presets: [
        {
          server: { EMPTY_FLAG: z.string().optional() },
          client: {},
          shared: {},
        },
      ],
    });

    expect(composedEnv.EMPTY_FLAG).toBeUndefined();
    expect(process.env.EMPTY_FLAG).toBe("");
    expect("EMPTY_FLAG" in process.env).toBe(true);
  });

  it("preserves process.env empty-string entries on lazy first access", async () => {
    const core = await importCoreWithEnv(undefined, { omitRequiredServices: true });
    process.env.EMPTY_FLAG = "";

    expect(core.env.NODE_ENV).toBe("test");
    expect(process.env.EMPTY_FLAG).toBe("");
    expect("EMPTY_FLAG" in process.env).toBe(true);
  });
});
