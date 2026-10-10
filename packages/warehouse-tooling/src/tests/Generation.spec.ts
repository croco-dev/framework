import { mkdtemp, readFile, rm, writeFile, symlink, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type * as FileSystem from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateDataArtifacts } from "../libs/generate";
vi.mock("node:fs/promises", async (load) => {
  const actual = await load<typeof FileSystem>();
  return { ...actual, writeFile: vi.fn(actual.writeFile), rm: vi.fn(actual.rm) };
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
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
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
    vi.mocked(writeFile).mockRejectedValueOnce(new Error("injected storage failure"));
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
});
