import { z } from "zod";
import { afterEach, describe, expect, expectTypeOf, it, vi } from "vitest";

import type { RuntimeEnvPreset } from "../core";

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
      expect(() => core.fullEnv.NODE_ENV).toThrow("Invalid environment variables");
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
      expect(() => core.fullEnv.NODE_ENV).toThrow("Invalid environment variables");
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
    expect(core.env.PORT).toBe("4000");
    expect(Object.getOwnPropertyDescriptor(core.env, "PORT")?.value).toBe(core.env.PORT);

    process.env.PORT = "5000";

    expect(core.env.PORT).toBe("5000");
    expect(Object.getOwnPropertyDescriptor(core.env, "PORT")?.value).toBe(core.env.PORT);
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
      ).toThrow("Invalid environment variables");
      expect(consoleError).toHaveBeenCalledWith(
        "❌ Invalid environment variables:",
        expect.arrayContaining([expect.objectContaining({ path: ["DATABASE_URL"] })]),
      );
    } finally {
      consoleError.mockRestore();
    }
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
});
