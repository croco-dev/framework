import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCroco } from "../commands/root.js";

const directories: string[] = [];
afterEach(() => {
  for (const directory of directories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

function fixture(source: string): string {
  const cwd = mkdtempSync(join(tmpdir(), "croco-pipeline-"));
  directories.push(cwd);
  writeFileSync(join(cwd, "pipeline.mjs"), source);
  return cwd;
}

async function invoke(cwd: string, action: string, extra: string[] = []) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const result = await runCroco(
    ["pipeline", action, "--config", "./pipeline.mjs", "--pipeline", "sales", ...extra],
    { cwd, stdout: (text) => stdout.push(text), stderr: (text) => stderr.push(text) },
  );
  return { ...result, stdout, stderr };
}

const operationsModule = `
let writes = 0;
export const pipelines = {
  sales: {
    validate() { return { valid: true, writes }; },
    preview() { return { inputCount: 3, outputCount: 2, writes }; },
    run() { writes++; return { executionId: 'run-1', state: 'quarantined', writes }; },
    retry(id) { return { executionId: id, state: 'failed' }; },
    status(id) { return { executionId: id, state: 'cancelled' }; }
  }
};`;

describe("pipeline CLI", () => {
  it.each([
    ["--dryRun", "pipeline", "run"],
    ["pipeline", "--dryRun", "run"],
  ])("rejects misplaced options before application code", async (...prefix) => {
    const cwd = fixture(`throw new Error('config must not load');`);
    const stderr: string[] = [];
    const result = await runCroco(
      [...prefix, "--config", "./pipeline.mjs", "--pipeline", "sales"],
      { cwd, stdout() {}, stderr: (text) => stderr.push(text) },
    );
    expect(result.exitCode).toBe(1);
    expect(stderr.join("\n")).toContain("Pipeline options must follow");
    expect(stderr.join("\n")).not.toContain("config must not load");
  });
  it("dispatches validation and preview without invoking writes", async () => {
    const cwd = fixture(operationsModule);
    const validation = await invoke(cwd, "validate");
    const preview = await invoke(cwd, "preview");
    expect(validation.exitCode).toBe(0);
    expect(preview.exitCode).toBe(0);
    expect(validation.stderr).toEqual([]);
    expect(preview.stderr).toEqual([]);
    expect(JSON.parse(validation.stdout[0])).toEqual({ valid: true, writes: 0 });
    expect(JSON.parse(preview.stdout[0])).toEqual({ inputCount: 3, outputCount: 2, writes: 0 });
  });

  it("preserves execution and inspector states rather than claiming completion", async () => {
    const cwd = fixture(operationsModule);
    const run = await invoke(cwd, "run");
    const retry = await invoke(cwd, "retry", ["--run", "run-1"]);
    const status = await invoke(cwd, "status", ["--run", "run-1"]);
    expect(run.exitCode).toBe(0);
    expect(JSON.parse(run.stdout[0])).toEqual({
      executionId: "run-1",
      state: "quarantined",
      writes: 1,
    });
    expect(JSON.parse(retry.stdout[0])).toEqual({ executionId: "run-1", state: "failed" });
    expect(JSON.parse(status.stdout[0])).toEqual({ executionId: "run-1", state: "cancelled" });
  });

  it.each(["retry", "status"])(
    "requires an execution ID before loading config for %s",
    async (action) => {
      const cwd = fixture(`throw new Error('config must not load');`);
      const result = await invoke(cwd, action);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.join("\n")).toContain("run");
      expect(result.stderr.join("\n")).not.toContain("config must not load");
    },
  );

  it.each(["--dryRun", "--dry-run", "--overwrite", "--unknown"])(
    "rejects unsupported %s before application code",
    async (flag) => {
      const cwd = fixture(`throw new Error('config must not load');`);
      const result = await invoke(cwd, "run", [flag]);
      expect(result.exitCode).toBe(1);
      expect(result.stderr.join("\n")).toContain("Unexpected pipeline argument");
      expect(result.stderr.join("\n")).not.toContain("config must not load");
    },
  );

  it.each([
    ["export const pipelines = {};", "Unknown pipeline"],
    ["export const pipelines = { sales: { run() {} } };", "must provide"],
    ["export default {};", "must export a pipelines registry"],
  ])("fails explicitly for invalid application configuration", async (source, message) => {
    const result = await invoke(fixture(source), "run");
    expect(result.exitCode).toBe(1);
    expect(result.stderr.join("\n")).toContain(message);
    expect(result.stdout).toEqual([]);
  });

  it("propagates application failure and missing reports", async () => {
    const failure = await invoke(
      fixture(
        operationsModule.replace(
          "writes++; return",
          "throw new Error('source revision changed'); return",
        ),
      ),
      "run",
    );
    expect(failure.exitCode).toBe(1);
    expect(failure.stderr.join("\n")).toContain("source revision changed");
    const missing = await invoke(
      fixture(operationsModule.replace("return { valid: true, writes };", "return undefined;")),
      "validate",
    );
    expect(missing.exitCode).toBe(1);
    expect(missing.stderr.join("\n")).toContain("returned no report");
  });

  it("resolves config relative to the explicit working directory", async () => {
    const cwd = fixture(operationsModule);
    const result = await invoke(tmpdir(), "validate", ["--cwd", cwd]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(result.stdout[0])).toEqual({ valid: true, writes: 0 });
  });
});
