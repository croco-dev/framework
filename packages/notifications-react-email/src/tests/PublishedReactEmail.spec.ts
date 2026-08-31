import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const packageDir = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rootDir = resolve(packageDir, "../..");
const timeoutMs = 180_000;
const skipPackedConsumer =
  process.env.CROCO_OFFLINE === "1" || process.env.npm_config_offline === "true";

describe("published React Email adapter", () => {
  it.skipIf(skipPackedConsumer)(
    "preserves typed renderer inference and ESM/CJS loading in a clean consumer",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-react-email-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-react-email-consumer-"));

      try {
        const packageNames = [
          "@croco/diagnostics-core",
          "@croco/events-core",
          "@croco/execution-core",
          "@croco/framework-context",
          "@croco/tasks-core",
          "@croco/telemetry-api",
          "@croco/problems-core",
          "@croco/protocols-core",
          "@croco/notifications-core",
          "@croco/engagement-core",
          "@croco/notifications-react-email",
        ] as const;
        ensureBuilt(packageNames);
        for (const packageName of packageNames) {
          pack(packageName, packRoot);
        }

        const tarballs = new Map(
          packageNames.map((packageName) => [
            packageName,
            findPackageTarball(packRoot, packageName),
          ]),
        );
        const problemsCore = requireTarball(tarballs, "@croco/problems-core");
        const protocolsCore = requireTarball(tarballs, "@croco/protocols-core");
        const notificationsCore = requireTarball(tarballs, "@croco/notifications-core");
        const engagementCore = requireTarball(tarballs, "@croco/engagement-core");
        const adapter = requireTarball(tarballs, "@croco/notifications-react-email");

        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify({ name: "react-email-consumer", private: true, type: "module" }, null, 2)}\n`,
        );
        writeFileSync(
          join(consumerRoot, "pnpm-workspace.yaml"),
          [
            "packages:",
            "  - .",
            "overrides:",
            ...[...tarballs.entries()]
              .filter(([packageName]) => packageName !== "@croco/notifications-react-email")
              .map(([packageName, tarball]) => `  '${packageName}': 'file:${tarball}'`),
            "",
          ].join("\n"),
        );
        run(
          "pnpm",
          [
            "add",
            "--prod",
            adapter,
            engagementCore,
            notificationsCore,
            problemsCore,
            protocolsCore,
            "@react-email/render@2.1.0",
            "@types/react@19",
            "@types/react-dom@19",
            "react@19.2.5",
            "react-dom@19.2.5",
            "zod@3.25.76",
            "--ignore-scripts",
          ],
          consumerRoot,
        );

        writeTypeConsumer(consumerRoot);
        run(
          "node",
          [join(rootDir, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
          consumerRoot,
        );
        writeRuntimeConsumers(consumerRoot);
        run("node", ["consumer.mjs"], consumerRoot);
        run("node", ["consumer.cjs"], consumerRoot);

        const manifest = JSON.parse(
          readFileSync(
            join(
              consumerRoot,
              "node_modules",
              "@croco",
              "notifications-react-email",
              "package.json",
            ),
            "utf8",
          ),
        ) as { readonly peerDependencies?: Readonly<Record<string, string>> };
        expect(manifest.peerDependencies).toEqual({
          "@react-email/render": ">=2.1.0 <3",
          react: ">=19.0.0 <20",
          "react-dom": ">=19.0.0 <20",
        });
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    timeoutMs,
  );
});

function ensureBuilt(packageNames: readonly string[]): void {
  if (packageNames.every((packageName) => existsBuiltPackage(packageName.replace("@croco/", "")))) {
    return;
  }
  run("pnpm", ["--filter", "@croco/notifications-react-email...", "build"], rootDir);
}

function existsBuiltPackage(directory: string): boolean {
  const packagePath = join(rootDir, "packages", directory);
  const declaration = join(packagePath, "dist", "index.d.ts");
  return (
    existsSync(declaration) && statSync(declaration).mtimeMs >= latestInputModifiedAt(packagePath)
  );
}

function latestInputModifiedAt(packagePath: string): number {
  return Math.max(
    statSync(join(packagePath, "package.json")).mtimeMs,
    latestTypeScriptModifiedAt(join(packagePath, "src")),
  );
}

function latestTypeScriptModifiedAt(directory: string): number {
  return readdirSync(directory, { withFileTypes: true }).reduce((latest, entry) => {
    const entryPath = join(directory, entry.name);
    if (entry.isDirectory()) {
      return Math.max(latest, latestTypeScriptModifiedAt(entryPath));
    }
    if (!entry.isFile() || (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx"))) {
      return latest;
    }
    return Math.max(latest, statSync(entryPath).mtimeMs);
  }, 0);
}

function pack(packageName: string, destination: string): void {
  run("pnpm", ["--filter", packageName, "pack", "--pack-destination", destination], rootDir);
}

function findTarball(directory: string, prefix: string): string {
  const filename = readdirSync(directory).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );
  if (filename === undefined) {
    throw new Error(`Missing packed tarball with prefix ${prefix}`);
  }
  return join(directory, filename);
}

function findPackageTarball(directory: string, packageName: string): string {
  return findTarball(directory, `${packageName.replace("@", "").replace("/", "-")}-`);
}

function requireTarball(tarballs: ReadonlyMap<string, string>, packageName: string): string {
  const tarball = tarballs.get(packageName);
  if (tarball === undefined) {
    throw new Error(`Missing packed tarball for ${packageName}`);
  }
  return tarball;
}

function writeTypeConsumer(consumerRoot: string): void {
  writeFileSync(
    join(consumerRoot, "contracts.ts"),
    [
      'import { defineMessage, type MessageContext, type MessageRenderer } from "@croco/engagement-core";',
      'import { reactEmail } from "@croco/notifications-react-email";',
      'import { createElement } from "react";',
      'import { z } from "zod";',
      "",
      'const Message = defineMessage({ id: "packed.email", topic: "packed", data: z.object({ name: z.string() }), channels: ["email"] });',
      "class Renderer implements MessageRenderer<typeof Message> {",
      '  async email({ data }: MessageContext<typeof Message, "email">) {',
      '    return reactEmail({ subject: data.name, body: createElement("p", undefined, data.name) });',
      "  }",
      "}",
      "void Renderer;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          lib: ["ES2022", "DOM", "ESNext.Disposable"],
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: false,
          strict: true,
          target: "ES2022",
        },
        include: ["contracts.ts"],
      },
      null,
      2,
    )}\n`,
  );
}

function writeRuntimeConsumers(consumerRoot: string): void {
  const assertion = [
    'const body = React.createElement("p", undefined, "Packed");',
    'const content = await ADAPTER.reactEmail({ subject: "Packed", body });',
    'if (content.subject !== "Packed" || !content.html.includes("Packed") || content.text !== "Packed") throw new Error("packed render failed");',
  ];
  writeFileSync(
    join(consumerRoot, "consumer.mjs"),
    [
      'import * as ADAPTER from "@croco/notifications-react-email";',
      'import * as React from "react";',
      ...assertion,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "consumer.cjs"),
    [
      '(async () => { const ADAPTER = require("@croco/notifications-react-email");',
      'const React = require("react");',
      ...assertion,
      "})().catch((error) => { console.error(error); process.exitCode = 1; });",
      "",
    ].join("\n"),
  );
}

function run(command: string, arguments_: readonly string[], cwd: string): string {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
    timeout: timeoutMs,
  });
  if (result.error !== undefined) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${arguments_.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
  return result.stdout;
}
