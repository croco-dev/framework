import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
  symlink,
  readdir,
  mkdir,
  rename,
  realpath,
} from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir, hostname } from "node:os";
import { join } from "node:path";
import type * as FileSystem from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDataArtifacts } from "../libs/generate";
vi.mock("node:fs/promises", async (load) => {
  const actual = await load<typeof FileSystem>();
  return {
    ...actual,
    writeFile: vi.fn(actual.writeFile),
    rm: vi.fn(actual.rm),
    rename: vi.fn(actual.rename),
  };
});
const roots: string[] = [];
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), "data-generation-"));
  roots.push(dir);
  return join(dir, "generated");
}
const first = {
  manifest: { version: 1 },
  files: { "schema.ts": "schema", "migrations/candidate.sql": "CREATE TABLE t(id TEXT);" },
};
afterEach(async () => {
  const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
  vi.mocked(rm).mockImplementation(actual.rm);
  vi.mocked(rename).mockImplementation(actual.rename);
  vi.mocked(writeFile).mockImplementation(actual.writeFile);
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
async function interruption(output: string, pid = spawnSync(process.execPath, ["-e", ""]).pid) {
  const canonical = await realpath(output);
  const token = randomUUID();
  const metadata = {
    token,
    pid,
    host: hostname(),
    output: canonical,
    stage: `${canonical}.stage-${token}`,
    backup: `${canonical}.backup-${token}`,
  };
  const lock = `${canonical}.croco-data-lock`;
  await mkdir(lock);
  await writeFile(join(lock, "owner.json"), JSON.stringify(metadata));
  await mkdir(metadata.stage);
  await writeFile(join(metadata.stage, "incomplete"), "new generation");
  await rename(canonical, metadata.backup);
  return { ...metadata, lock };
}
describe("generated ownership", () => {
  it("is deterministic and retains manual files and old migration candidates", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const before = await readFile(join(output, ".croco-data-ownership.json"), "utf8");
    await writeFile(join(output, "manual.sql"), "manual");
    await writeFile(join(output, ".env"), "SECRET=keep-local");
    await generateDataArtifacts(output, first, { migrationId: "one" });
    expect(await readFile(join(output, ".croco-data-ownership.json"), "utf8")).toBe(before);
    await generateDataArtifacts(
      output,
      { manifest: {}, files: { "migrations/candidate.sql": "second" } },
      { migrationId: "two" },
    );
    expect(await readFile(join(output, "manual.sql"), "utf8")).toBe("manual");
    expect(await readFile(join(output, ".env"), "utf8")).toBe("SECRET=keep-local");
    expect(await readdir(join(output, "migrations"))).toEqual(["one.sql", "two.sql"]);
    expect(await readdir(output)).not.toContain("schema.ts");
  });
  it("preserves prior artifacts when an owned file is edited or a migration ID changes", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await expect(
      generateDataArtifacts(
        output,
        { ...first, files: { "migrations/candidate.sql": "different" } },
        { migrationId: "one" },
      ),
    ).rejects.toMatchObject({ reason: "migration-id-conflict" });
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("schema");
    await writeFile(join(output, "schema.ts"), "edited");
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "modified-owned-file" });
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("edited");
  });
  it("canonicalizes nested maps and reports the actual migration artifact path", async () => {
    const output = await fixture();
    const compilation = {
      manifest: {
        budgets: { rows: 1, bytes: 2 },
        artifacts: { "migrations/candidate.sql": "digest" },
      },
      files: first.files,
    };
    const actual = await generateDataArtifacts(output, compilation, { migrationId: "one" });
    expect(actual.artifacts).toEqual({ "migrations/one.sql": "digest" });
    const before = await readFile(join(output, ".croco-data-ownership.json"), "utf8");
    await generateDataArtifacts(
      output,
      { ...compilation, manifest: { ...compilation.manifest, budgets: { bytes: 2, rows: 1 } } },
      { migrationId: "one" },
    );
    expect(await readFile(join(output, ".croco-data-ownership.json"), "utf8")).toBe(before);
  });
  it("keeps the previous directory when staging a write fails", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await writeFile(join(output, "manual.sql"), "manual");
    const before = await readFile(join(output, ".croco-data-ownership.json"), "utf8");
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    vi.mocked(writeFile).mockImplementation(async (path, content, options) => {
      if (String(path).includes(".stage-")) throw new Error("injected storage failure");
      return actual.writeFile(path, content, options);
    });
    await expect(
      generateDataArtifacts(
        output,
        { ...first, files: { "new.ts": "new" } },
        { migrationId: "two" },
      ),
    ).rejects.toThrow("injected storage failure");
    expect(await readFile(join(output, ".croco-data-ownership.json"), "utf8")).toBe(before);
    expect(await readFile(join(output, "manual.sql"), "utf8")).toBe("manual");
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("schema");
    expect(
      (await readdir(join(output, ".."))).filter(
        (name) =>
          name.includes(".stage-") ||
          name.includes(".backup-") ||
          name.includes(".croco-data-lock"),
      ),
    ).toEqual([]);
  });
  it("reports a committed cleanup failure and releases the generation lock", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const remove = vi.mocked(rm).getMockImplementation();
    vi.mocked(rm).mockImplementation(async (path, options) => {
      if (String(path).includes(".backup-")) throw new Error("injected backup cleanup failure");
      return remove?.(path, options);
    });
    await expect(
      generateDataArtifacts(
        output,
        { ...first, files: { "schema.ts": "new" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({
      reason: "committed-cleanup-failed",
      committedManifest: first.manifest,
    });
    if (!remove) throw new Error("missing test implementation");
    vi.mocked(rm).mockImplementation(remove);
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("new");
    expect(await readdir(join(output, ".."))).not.toContain("generated.croco-data-lock");
    await generateDataArtifacts(output, first, { migrationId: "one" });
  });
  it("refuses ownership traversal, unowned collision and symlink traversal", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await writeFile(join(output, "manual.ts"), "keep");
    await expect(
      generateDataArtifacts(
        output,
        { manifest: {}, files: { "manual.ts": "replace" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({ reason: "unowned-file-conflict" });
    await expect(
      generateDataArtifacts(
        output,
        { manifest: {}, files: { "../secret": "replace" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({ reason: "invalid-owned-path" });
    await symlink(join(output, "manual.ts"), join(output, "link"));
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "unsupported-file" });
    expect(await readFile(join(output, "manual.ts"), "utf8")).toBe("keep");
  });
  it("restores only a verified interrupted generation and reports the preserved staging path", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await writeFile(join(output, "manual.sql"), "manual");
    const state = await interruption(output);
    const unrelated = `${state.output}.backup-${randomUUID()}`;
    await mkdir(unrelated);
    await writeFile(join(unrelated, "evidence"), "unrelated");
    await expect(
      generateDataArtifacts(
        output,
        { manifest: {}, files: { "schema.ts": "replacement" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({ reason: "interrupted-generation-restored", file: state.stage });
    expect(await readFile(join(output, "manual.sql"), "utf8")).toBe("manual");
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("schema");
    expect(await readFile(join(state.stage, "incomplete"), "utf8")).toBe("new generation");
    expect(await readFile(join(unrelated, "evidence"), "utf8")).toBe("unrelated");
    await expect(readFile(join(state.lock, "owner.json"))).rejects.toMatchObject({
      code: "ENOENT",
    });
    await generateDataArtifacts(output, first, { migrationId: "one" });
  });
  it("does not restore an active generation or a mismatched backup", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const state = await interruption(output, process.pid);
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "generation-in-progress" });
    expect(await readFile(join(state.backup, "schema.ts"), "utf8")).toBe("schema");
    const dead = spawnSync(process.execPath, ["-e", ""]).pid;
    await writeFile(
      join(state.lock, "owner.json"),
      JSON.stringify({ ...state, pid: dead, backup: `${state.backup}-unrelated` }),
    );
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "generation-recovery-required", file: state.lock });
    expect(await readFile(join(state.backup, "schema.ts"), "utf8")).toBe("schema");
  });
  it("preserves ambiguous interrupted backups with actionable recovery diagnostics", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const state = await interruption(output);
    await writeFile(join(state.backup, "schema.ts"), "edited after interruption");
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({
      reason: "generation-recovery-required",
      file: state.backup,
      cause: { reason: "modified-owned-file" },
    });
    expect(await readFile(join(state.backup, "schema.ts"), "utf8")).toBe(
      "edited after interruption",
    );
    expect(await readFile(join(state.stage, "incomplete"), "utf8")).toBe("new generation");
  });
  it("never replaces an existing output while inspecting an interrupted backup", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const state = await interruption(output);
    await mkdir(output);
    await writeFile(join(output, "manual.sql"), "newer manual directory");
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "generation-recovery-required", file: state.backup });
    expect(await readFile(join(output, "manual.sql"), "utf8")).toBe("newer manual directory");
    expect(await readFile(join(state.backup, "schema.ts"), "utf8")).toBe("schema");
  });
  it("retains the bound backup and lock when both commit and rollback fail", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await writeFile(join(output, "manual.sql"), "manual");
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    vi.mocked(rename).mockImplementation(async (from, to) => {
      if (String(from).includes(".stage-")) throw new Error("commit rename failed");
      if (String(from).includes(".backup-")) throw new Error("rollback rename failed");
      return actual.rename(from, to);
    });
    await expect(
      generateDataArtifacts(
        output,
        { ...first, files: { "schema.ts": "next" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({
      reason: "generation-recovery-required",
      cause: {
        errors: [{ message: "commit rename failed" }, { message: "rollback rename failed" }],
      },
    });
    const lock = `${output}.croco-data-lock`;
    const metadata = JSON.parse(await readFile(join(lock, "owner.json"), "utf8")) as {
      backup: string;
      stage: string;
      pid: number;
    };
    expect(await readFile(join(metadata.backup, "manual.sql"), "utf8")).toBe("manual");
    expect(await readFile(join(metadata.stage, "schema.ts"), "utf8")).toBe("next");
    vi.mocked(rename).mockImplementation(actual.rename);
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "generation-in-progress" });
    await writeFile(
      join(lock, "owner.json"),
      JSON.stringify({ ...metadata, pid: spawnSync(process.execPath, ["-e", ""]).pid }),
    );
    await expect(
      generateDataArtifacts(output, first, { migrationId: "two" }),
    ).rejects.toMatchObject({ reason: "interrupted-generation-restored" });
    expect(await readFile(join(output, "manual.sql"), "utf8")).toBe("manual");
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("schema");
  });
  it("preserves the original generation error and every cleanup failure", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    await writeFile(join(output, "manual.ts"), "keep");
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    vi.mocked(rm).mockImplementation(async (path, options) => {
      if (String(path).includes(".stage-")) throw new Error("stage cleanup failure");
      if (String(path).endsWith(".croco-data-lock")) throw new Error("lock cleanup failure");
      return actual.rm(path, options);
    });
    await expect(
      generateDataArtifacts(
        output,
        { manifest: {}, files: { "manual.ts": "replace" } },
        { migrationId: "two" },
      ),
    ).rejects.toMatchObject({
      reason: "staging-cleanup-failed",
      cause: {
        errors: [
          { reason: "unowned-file-conflict" },
          { reason: "staging-cleanup-failed", cause: { message: "stage cleanup failure" } },
          { reason: "lock-cleanup-failed", cause: { message: "lock cleanup failure" } },
        ],
      },
    });
    expect(await readFile(join(output, "manual.ts"), "utf8")).toBe("keep");
  });
  it("keeps the first committed cleanup failure and the later lock failure", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    vi.mocked(rm).mockImplementation(async (path, options) => {
      if (String(path).includes(".backup-")) throw new Error("backup cleanup failure");
      if (String(path).endsWith(".croco-data-lock")) throw new Error("lock cleanup failure");
      return actual.rm(path, options);
    });
    await expect(
      generateDataArtifacts(output, first, { migrationId: "one" }),
    ).rejects.toMatchObject({
      reason: "committed-cleanup-failed",
      committedManifest: first.manifest,
      cause: {
        errors: [
          { reason: "committed-cleanup-failed", cause: { message: "backup cleanup failure" } },
          { reason: "committed-lock-cleanup-failed", cause: { message: "lock cleanup failure" } },
        ],
      },
    });
    expect(await readFile(join(output, "schema.ts"), "utf8")).toBe("schema");
  });
  it("retains primitive cleanup failures as nonenumerable causes", async () => {
    const output = await fixture();
    await generateDataArtifacts(output, first, { migrationId: "one" });
    const actual = await vi.importActual<typeof FileSystem>("node:fs/promises");
    vi.mocked(rm).mockImplementation(async (path, options) => {
      if (String(path).endsWith(".croco-data-lock"))
        return Promise.reject("primitive cleanup evidence");
      return actual.rm(path, options);
    });
    const failure = await generateDataArtifacts(output, first, { migrationId: "one" }).catch(
      (error) => error,
    );
    expect(failure).toMatchObject({
      reason: "committed-lock-cleanup-failed",
      cause: {
        errors: [{ reason: "committed-lock-cleanup-failed", cause: "primitive cleanup evidence" }],
      },
    });
    expect(JSON.stringify(failure)).not.toContain("primitive cleanup evidence");
  });
});
