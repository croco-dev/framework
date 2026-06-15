import { beforeEach, describe, expect, it, vi } from "vitest";

const generationModuleImports = vi.hoisted(() => ({
  generate: 0,
  loadRoutes: 0,
}));

vi.mock("../libs/generate", () => {
  generationModuleImports.generate += 1;

  return {
    generateClientFiles: () => {
      throw new Error("generateClientFiles should not run for help or invalid arguments");
    },
  };
});

vi.mock("../libs/loadRoutes", () => {
  generationModuleImports.loadRoutes += 1;

  return {
    loadRoutes: () => {
      throw new Error("loadRoutes should not run for help or invalid arguments");
    },
  };
});

import { runCli } from "../libs/cli";

describe("rpc-codegen CLI", () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    generationModuleImports.generate = 0;
    generationModuleImports.loadRoutes = 0;
  });

  it("exits successfully for help without loading generation modules", async () => {
    const exitCode = await runCli(["--help"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("Usage: croco-rpc-codegen");
    expect(generationModuleImports).toEqual({
      generate: 0,
      loadRoutes: 0,
    });
  });

  it.each([
    ["no arguments", []],
    ["missing controllers", ["--out", "client"]],
    ["missing output", ["--controllers", "src/controllers/**/*.ts"]],
  ])("exits with failure for %s without loading generation modules", async (_name, args) => {
    const exitCode = await runCli(args, {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("Usage: croco-rpc-codegen");
    expect(generationModuleImports).toEqual({
      generate: 0,
      loadRoutes: 0,
    });
  });
});
