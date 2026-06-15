import { beforeEach, describe, expect, it, vi } from "vitest";

const generationModuleImports = vi.hoisted(() => ({
  emitOpenAPI: 0,
  loadControllers: 0,
}));

vi.mock("../libs/emitOpenAPI", () => {
  generationModuleImports.emitOpenAPI += 1;

  return {
    emitOpenAPI: () => {
      throw new Error("emitOpenAPI should not run for help or invalid arguments");
    },
  };
});

vi.mock("../libs/loadControllers", () => {
  generationModuleImports.loadControllers += 1;

  return {
    loadControllers: () => {
      throw new Error("loadControllers should not run for help or invalid arguments");
    },
  };
});

import { runCli } from "../libs/cli";

describe("openapi-spec CLI", () => {
  let stdout: string[];

  beforeEach(() => {
    stdout = [];
    generationModuleImports.emitOpenAPI = 0;
    generationModuleImports.loadControllers = 0;
  });

  it("exits successfully for help without loading generation modules", async () => {
    const exitCode = await runCli(["--help"], {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(0);
    expect(stdout.join("\n")).toContain("Usage: croco-openapi-spec");
    expect(generationModuleImports).toEqual({
      emitOpenAPI: 0,
      loadControllers: 0,
    });
  });

  it.each([
    ["no arguments", []],
    ["missing controllers", ["--out", "openapi.json"]],
    ["missing output", ["--controllers", "src/controllers/**/*.ts"]],
  ])("exits with failure for %s without loading generation modules", async (_name, args) => {
    const exitCode = await runCli(args, {
      stdout: (message) => stdout.push(message),
    });

    expect(exitCode).toBe(1);
    expect(stdout.join("\n")).toContain("Usage: croco-openapi-spec");
    expect(generationModuleImports).toEqual({
      emitOpenAPI: 0,
      loadControllers: 0,
    });
  });
});
