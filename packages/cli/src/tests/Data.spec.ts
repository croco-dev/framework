import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { hostname, tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateDataArtifacts } from "@croco/warehouse-tooling/offline";
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
  it.each([
    { reason: "modified-owned-file", file: "manifest.json" },
    { reason: "unowned-file-conflict", file: "schema/index.ts" },
    { reason: "migration-id-conflict", file: "migrations/initial.sql" },
  ])("reports $reason and retains existing files", async ({ reason, file }) => {
    const config = {
      connections: [{ id: "primary", env: "DATABASE_URL" }],
      sources: [],
      pipelines: [],
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
            description: "Payments",
            grain: { description: "One payment", key: ["id"] },
            columns: { id: { type: "id" }, at: { type: "instant", precision: "millisecond" } },
            time: { event: "at" },
            write: { mode: "append", duplicate: "ignore-identical", conflict: "reject" },
            sourceRefs: [],
          },
        },
      ],
    };
    const cwd = fixture(`export default ${JSON.stringify(config)};`);
    const output = join(cwd, "generated");
    const args = ["--output", "generated", "--migration-id", "initial"];
    if (reason === "unowned-file-conflict") {
      mkdirSync(join(output, "schema"), { recursive: true });
      writeFileSync(join(output, file), "private manual contents");
    } else {
      expect((await invoke(cwd, "generate", args)).exitCode).toBe(0);
      if (reason === "modified-owned-file")
        writeFileSync(join(output, file), "private manual contents");
      else {
        config.models[0].fact.description = "Updated payment documentation";
        writeFileSync(join(cwd, "data.config.ts"), `export default ${JSON.stringify(config)};`);
      }
    }
    const retained = readFileSync(join(output, file), "utf8");
    writeFileSync(join(output, ".env"), "PRIVATE_SECRET=private-secret-value");
    const result = await invoke(cwd, "generate", args);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(JSON.parse(result.stderr[0])).toEqual({
      code: "DATA_GENERATION_FAILED",
      reason,
      file,
    });
    expect(result.stderr.join()).not.toContain(cwd);
    expect(result.stderr.join()).not.toContain("private");
    expect(readFileSync(join(output, file), "utf8")).toBe(retained);
    expect(readFileSync(join(output, ".env"), "utf8")).toBe("PRIVATE_SECRET=private-secret-value");
  });
  it.each([
    "interrupted-generation-restored",
    "generation-recovery-required",
    "generation-in-progress",
  ])("reports the exact relative recovery artifact for %s", async (reason) => {
    const cwd = fixture(valid);
    const args = ["--output", "nested/generated", "--migration-id", "initial"];
    await generateDataArtifacts(
      join(cwd, "nested/generated"),
      { manifest: {}, files: { "manifest.json": "{}" } },
      { migrationId: "initial" },
    );
    const output = realpathSync(join(cwd, "nested/generated"));
    const token = randomUUID();
    const backup = `${output}.backup-${token}`;
    const stage = `${output}.stage-${token}`;
    const lock = `${output}.croco-data-lock`;
    const pid =
      reason === "generation-in-progress"
        ? process.pid
        : spawnSync(process.execPath, ["-e", ""]).pid;
    mkdirSync(lock);
    writeFileSync(
      join(lock, "owner.json"),
      JSON.stringify({ token, pid, host: hostname(), output, stage, backup }),
    );
    mkdirSync(stage);
    writeFileSync(join(stage, "preserved"), "incomplete generation");
    renameSync(output, backup);
    if (reason === "generation-recovery-required")
      writeFileSync(join(backup, "manifest.json"), "private changed content");
    const result = await invoke(cwd, "generate", args);
    const suffix =
      reason === "interrupted-generation-restored"
        ? `.stage-${token}`
        : reason === "generation-in-progress"
          ? ".croco-data-lock"
          : `.backup-${token}`;
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([]);
    expect(JSON.parse(result.stderr[0])).toEqual({
      code: "DATA_GENERATION_FAILED",
      reason,
      file: `nested/generated${suffix}`,
    });
    expect(result.stderr.join()).not.toContain(realpathSync(cwd));
    expect(result.stderr.join()).not.toContain("private changed content");
    expect(readFileSync(join(stage, "preserved"), "utf8")).toBe("incomplete generation");
  });
  it.each(["generated", ...(sep === "/" ? ["generated\\archive"] : [])])(
    "reports the exact recovery lock for %s without exposing an untrusted metadata path",
    async (output) => {
      const cwd = fixture(valid);
      const lock = join(cwd, `${output}.croco-data-lock`);
      mkdirSync(lock);
      writeFileSync(
        join(lock, "owner.json"),
        JSON.stringify({ backup: "/private/secret/location" }),
      );
      const result = await invoke(cwd, "generate", [
        "--output",
        output,
        "--migration-id",
        "initial",
      ]);
      expect(JSON.parse(result.stderr[0])).toEqual({
        code: "DATA_GENERATION_FAILED",
        reason: "generation-recovery-required",
        file: `${output}.croco-data-lock`,
      });
      expect(result.stderr.join()).not.toContain("secret");
    },
  );
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
