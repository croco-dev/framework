import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { ApplicationIntentGoal } from "@croco/framework-context";
import type { TenantModelName as CanonicalTenantModelName } from "@croco/tenant-core/tenant-model";
import type { AppGoal, TenantModelName } from "../types.js";

describe("create-croco-app programmatic entrypoints", () => {
  it("keeps published option types aligned with canonical contracts", () => {
    expectTypeOf<AppGoal>().toEqualTypeOf<ApplicationIntentGoal>();
    expectTypeOf<TenantModelName>().toEqualTypeOf<CanonicalTenantModelName>();
  });

  it("loads without parsing arguments, writing output, or exiting", async () => {
    const importDirectory = mkdtempSync(join(tmpdir(), "create-croco-app-import-"));
    const originalDirectory = process.cwd();
    const parseAsync = vi.spyOn(Command.prototype, "parseAsync");
    const consoleLog = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const processExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit must not be called during import");
    });

    try {
      process.chdir(importDirectory);
      const rootApi = await import("../index.js");
      const programmaticApi = await import("../programmatic.js");

      expect(rootApi.generate).toBeTypeOf("function");
      expect(rootApi.normalizeNonInteractiveOptions).toBeTypeOf("function");
      expect(programmaticApi.createProgram).toBeTypeOf("function");
      expect(programmaticApi.validateResolvedOptions).toBeTypeOf("function");
      expect(parseAsync).not.toHaveBeenCalled();
      expect(consoleLog).not.toHaveBeenCalled();
      expect(consoleError).not.toHaveBeenCalled();
      expect(processExit).not.toHaveBeenCalled();
      expect(readdirSync(importDirectory)).toEqual([]);
    } finally {
      process.chdir(originalDirectory);
      rmSync(importDirectory, { force: true, recursive: true });
      vi.restoreAllMocks();
    }
  });
});
