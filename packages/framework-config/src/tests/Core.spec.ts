import { afterEach, describe, expect, it, vi } from "vitest";

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

    expect(core.env.DATABASE_URL).toBeUndefined();
  });

  it.each(["false", "0", "no"])("treats %s as disabled skipValidation", async (value) => {
    const core = await importCoreWithEnv(value, { omitRequiredServices: true });
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      expect(() => core.env.NODE_ENV).toThrow("Invalid environment variables");
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
      expect(() => core.env.NODE_ENV).toThrow("Invalid environment variables");
    } finally {
      consoleError.mockRestore();
    }
  });

  it("preserves server-only environment access failures on the client", async () => {
    const core = await importCoreWithEnv(undefined);
    Reflect.set(globalThis, "window", {});

    try {
      expect(() => core.env.DATABASE_URL).toThrow(
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
    expect(Object.keys(core.env)).toContain("DATABASE_URL");
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

  it("fails fast for invalid SKIP_ENV_VALIDATION values", async () => {
    await expect(importCoreWithEnv("banana")).rejects.toMatchObject({
      code: "framework-config/invalid-boolean-env",
      detail: "Invalid boolean env value for 'SKIP_ENV_VALIDATION': 'banana'",
    });
  });
});
