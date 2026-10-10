import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCroco } from "../commands/root.js";

const directories: string[] = [];
afterEach(() => {
  for (const path of directories.splice(0)) rmSync(path, { recursive: true, force: true });
});
const valid = `export default { connections: [], sources: [], models: [], pipelines: [] };`;
function fixture(source: string) {
  const cwd = mkdtempSync(join(tmpdir(), "croco-data-"));
  directories.push(cwd);
  writeFileSync(join(cwd, "data.config.ts"), source);
  return cwd;
}
async function invoke(cwd: string, action = "validate", extra: string[] = []) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const result = await runCroco(["data", action, "--config", "data.config.ts", ...extra], {
    cwd,
    stdout: (text) => stdout.push(text),
    stderr: (text) => stderr.push(text),
  });
  return { ...result, stdout, stderr };
}

describe("data CLI", () => {
  it("loads TypeScript config without credentials or config console output", async () => {
    const key = "CROCO_DATA_TEST_SECRET";
    process.env[key] = "secret-that-must-not-leak";
    try {
      const cwd = fixture(
        `const name: string = '${key}'; if (process.env[name]) throw new Error(process.env[name]); console.log('private config output'); ${valid}`,
      );
      const result = await invoke(cwd);
      expect(result.exitCode).toBe(0);
      expect(result.stderr).toEqual([]);
      expect(JSON.parse(result.stdout[0])).toMatchObject({
        status: "valid",
        manifest: { nodes: [] },
      });
      expect(result.stdout.join()).not.toContain("private config output");
    } finally {
      delete process.env[key];
    }
  });
  it.each([
    `await fetch('https://example.com');`,
    `import { connect } from 'node:net'; connect(443, 'example.com');`,
    `import { get } from 'node:https'; get('https://example.com');`,
  ])("refuses network access before validation", async (source) => {
    const result = await invoke(fixture(`${source} ${valid}`));
    expect(result).toEqual({ exitCode: 1, stdout: [], stderr: ["DATA_CONFIG_NETWORK_DENIED"] });
  });
  it("denies config writes", async () => {
    expect(
      (
        await invoke(
          fixture(
            `import { writeFileSync } from 'node:fs'; writeFileSync('unexpected', 'secret'); ${valid}`,
          ),
        )
      ).stderr,
    ).toEqual(["ERR_ACCESS_DENIED"]);
  });
  it("denies child processes", async () => {
    expect(
      (
        await invoke(
          fixture(`import { execSync } from 'node:child_process'; execSync('true'); ${valid}`),
        )
      ).stderr,
    ).toEqual(["ERR_ACCESS_DENIED"]);
  });
  it("never echoes raw config exceptions", async () => {
    const result = await invoke(fixture(`throw new Error('private connection string');`));
    expect(result).toEqual({ exitCode: 1, stdout: [], stderr: ["DATA_CONFIG_INVALID"] });
  });
  it("generates validated artifacts", async () => {
    const cwd = fixture(valid);
    const result = await invoke(cwd, "generate", [
      "--output",
      "generated",
      "--migration-id",
      "initial",
    ]);
    expect(result.exitCode).toBe(0);
    expect(JSON.parse(readFileSync(join(cwd, "generated", "manifest.json"), "utf8")).nodes).toEqual(
      [],
    );
  });
  it("denies reads outside the project and installed tooling", async () => {
    const outside = fixture("private file content");
    const cwd = fixture(
      `import { readFileSync } from 'node:fs'; readFileSync(${JSON.stringify(join(outside, "data.config.ts"))}); ${valid}`,
    );
    expect((await invoke(cwd)).stderr).toEqual(["ERR_ACCESS_DENIED"]);
  });
  it("reports stable compiler reasons without raw declaration detail", async () => {
    const cwd = fixture(
      `export default { connections: [{id: 'main', env: 'DB_URL'}, {id: 'main', env: 'DB_URL'}], sources: [], models: [], pipelines: [] };`,
    );
    const result = await invoke(cwd);
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr[0])).toEqual({
      code: "DATA_CONFIG_INVALID",
      reason: "duplicate-connection",
    });
  });
  it("preserves the upstream reason and source location for a deleted grain key", async () => {
    const config = {
      connections: [{ id: "primary", env: "DATABASE_URL" }],
      sources: [],
      models: [
        {
          backend: "postgres",
          connection: "primary",
          location: { file: "data.config.ts", line: 5, column: 3 },
          fact: {
            name: "payments",
            version: 1,
            kind: "transaction",
            scope: "tenant",
            grain: { description: "One payment", key: ["id"] },
            columns: { at: { type: "instant", precision: "millisecond" } },
            time: { event: "at" },
            write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
            sourceRefs: [],
          },
        },
      ],
      pipelines: [],
    };
    const result = await invoke(fixture(`export default ${JSON.stringify(config)};`));
    expect(result.exitCode).toBe(1);
    expect(JSON.parse(result.stderr[0])).toEqual({
      code: "DATA_CONFIG_INVALID",
      reason: "WAREHOUSE_INVALID_GRAIN",
      location: { file: "data.config.ts", line: 5, column: 3 },
    });
  });
  it("terminates configs that never settle", async () => {
    expect(
      (await invoke(fixture(`await new Promise(() => setInterval(() => {}, 1000)); ${valid}`)))
        .stderr,
    ).toEqual(["DATA_CONFIG_TIMEOUT"]);
  }, 15_000);
  it("rejects unknown options before loading config", async () => {
    const result = await invoke(fixture(`throw new Error('private');`), "validate", [
      "--apply",
      "yes",
    ]);
    expect(result.stderr).toEqual(["DATA_COMMAND_INVALID_ARGUMENTS"]);
  });
});
