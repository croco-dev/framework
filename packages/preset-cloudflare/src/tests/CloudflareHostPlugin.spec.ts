import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { Container } from "@croco/framework-context";
import { createApplicationRuntime, defineCrocoApplication } from "@croco/framework-module";
import { cloudflareWorkersHost, CLOUDFLARE_ENV_TOKEN } from "../application";

describe("Cloudflare host native environment ownership", () => {
  beforeEach(() => Container.reset());
  it("keeps native bindings in the owning application without graph secret disclosure", async () => {
    const first = { SECRET: "first-private-value", BUCKET: { get: async () => null } };
    const second = { SECRET: "second-private-value" };
    const runtimes = [first, second].map((env) =>
      createApplicationRuntime(defineCrocoApplication({ imports: [cloudflareWorkersHost(env)] })),
    );
    try {
      await Promise.all(runtimes.map((runtime) => runtime.initialize()));
      const [a, b] = runtimes;
      if (!a || !b) throw new Error("Missing test runtimes");
      expect(a.get(CLOUDFLARE_ENV_TOKEN)).toBe(first);
      expect(b.get(CLOUDFLARE_ENV_TOKEN)).toBe(second);
      const readA = a.bindHostCallback(async () => Container.get(CLOUDFLARE_ENV_TOKEN));
      await expect(b.run(() => readA())).resolves.toBe(first);
      const graph = a.createGraphManifest();
      expect(graph.status).toBe("ready");
      expect(graph.plugins).toMatchObject([
        {
          name: "cloudflare-workers-host",
          runtimeCompatibility: ["cloudflare-workers"],
          capabilities: [{ id: "runtime.host", kind: "single" }],
        },
      ]);
      expect(JSON.stringify(graph)).not.toContain("first-private-value");
      expect(graph.moduleGraph.modules.map(({ name }) => name)).toEqual([
        "@croco/preset-cloudflare/host",
      ]);
    } finally {
      await Promise.all(runtimes.map((runtime) => runtime.dispose()));
    }
  });
  it("exposes the application entrypoint to both native ESM and generated CommonJS tooling", () => {
    const root = mkdtempSync(join(tmpdir(), "croco-worker-exports-"));
    try {
      const pkg = JSON.parse(
        readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
      ) as {
        name: string;
        publishConfig: { exports: Record<string, unknown> };
      };
      const installed = join(root, "node_modules/@croco/preset-cloudflare");
      mkdirSync(join(installed, "dist"), { recursive: true });
      writeFileSync(
        join(installed, "package.json"),
        JSON.stringify({ name: pkg.name, type: "module", exports: pkg.publishConfig.exports }),
      );
      writeFileSync(
        join(installed, "dist/application.mjs"),
        'export const probe = "native-host";\n',
      );
      const result = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "--eval",
          `
        import { createRequire } from "node:module";
        import { probe } from "@croco/preset-cloudflare/application";
        const loaded = createRequire(import.meta.url)("@croco/preset-cloudflare/application");
        if (probe !== "native-host" || loaded.probe !== probe) throw new Error("Application exports differ");
      `,
        ],
        { cwd: root, encoding: "utf8" },
      );
      expect(result.stderr).toBe("");
      expect(result.status).toBe(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
