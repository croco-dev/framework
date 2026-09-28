import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { expect, it } from "vitest";

it("prints the inspectable graph through the documented start command", () => {
  const output = execFileSync("pnpm", ["run", "--silent", "start"], {
    cwd: resolve(import.meta.dirname, "../.."),
    encoding: "utf8",
  });

  expect(Object.keys(JSON.parse(output))).toEqual([
    "auth",
    "billing",
    "datastore",
    "productionGoldenPath",
    "tasksTelemetry",
  ]);
}, 120_000);
