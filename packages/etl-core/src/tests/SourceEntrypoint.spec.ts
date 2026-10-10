import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageRoot = fileURLToPath(new URL("../..", import.meta.url));
const decode = String.raw`
  async function* bytes() {
    yield new TextEncoder().encode('{"id":7}\n');
  }
  (async () => {
    const rows = [];
    for await (const row of decodeSource(bytes(), {
      format: "jsonl",
      encoding: "utf-8",
      fields: [{ name: "id", type: "number" }],
      limits: { maxBytes: 1024, maxRecords: 10, maxRowBytes: 128 },
    })) rows.push(row);
    process.stdout.write(JSON.stringify(rows));
  })().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
`;

describe("native source entrypoint", () => {
  it.each(["module", "commonjs"])("decodes source rows through the %s entrypoint", (mode) => {
    const load =
      mode === "module"
        ? 'import { decodeSource } from "@croco/etl-core/source";'
        : 'const { decodeSource } = require("@croco/etl-core/source");';
    const result = spawnSync(process.execPath, ["--input-type=" + mode, "--eval", load + decode], {
      cwd: packageRoot,
      encoding: "utf8",
      timeout: 5000,
    });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    expect(JSON.parse(result.stdout)).toEqual([{ id: 7 }]);
  });
});
