import { afterEach, describe, expect, it, vi } from "vitest";

import { InvalidBooleanEnvProblem } from "../libs/problems/ConfigProblems";

const DEFAULT_ENV = {
  NODE_ENV: "test",
  NEXT_PUBLIC_APP_NAME: "Croco",
  NEXT_PUBLIC_APP_URL: "https://example.com",
} satisfies Record<string, string>;

async function importCoreWithEnv(skipValue: string | undefined) {
  vi.resetModules();

  process.env = {
    ...process.env,
    ...DEFAULT_ENV,
  };

  if (skipValue === undefined) {
    delete process.env.SKIP_ENV_VALIDATION;
  } else {
    process.env.SKIP_ENV_VALIDATION = skipValue;
  }

  return import("../core");
}

describe("framework-config core skipValidation parser", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    vi.resetModules();
  });

  it.each(["true", "1", "yes"])("enables skipValidation for %s", async (value) => {
    await expect(importCoreWithEnv(value)).resolves.toHaveProperty("env");
  });

  it.each(["false", "0", "no"])("treats %s as disabled skipValidation", async (value) => {
    await expect(importCoreWithEnv(value)).resolves.toHaveProperty("env");
  });

  it("treats missing SKIP_ENV_VALIDATION as disabled", async () => {
    await expect(importCoreWithEnv(undefined)).resolves.toHaveProperty("env");
  });

  it("fails fast for invalid SKIP_ENV_VALIDATION values", async () => {
    await expect(importCoreWithEnv("banana")).rejects.toMatchObject({
      code: "framework-config/invalid-boolean-env",
      detail: "Invalid boolean env value for 'SKIP_ENV_VALIDATION': 'banana'",
    });
  });
});
