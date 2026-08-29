import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageDir = resolve(__dirname, "../..");
const rootDir = resolve(packageDir, "../..");
const spawnTimeoutMs = 180_000;
const TEST_TIMEOUT_MS = 300_000;
const skipPackedConsumer =
  process.env.CROCO_OFFLINE === "1" || process.env.npm_config_offline === "true";

describe("published message contracts", () => {
  it.skipIf(skipPackedConsumer)(
    "preserves TypeScript declaration contracts and ESM/CJS loading in a clean packed consumer",
    () => {
      const packRoot = mkdtempSync(join(tmpdir(), "croco-engagement-core-pack-"));
      const consumerRoot = mkdtempSync(join(tmpdir(), "croco-engagement-core-consumer-"));

      try {
        ensureBuilt();
        const packageNames = [
          "@croco/diagnostics-core",
          "@croco/engagement-core",
          "@croco/events-core",
          "@croco/execution-core",
          "@croco/framework-context",
          "@croco/notifications-core",
          "@croco/problems-core",
          "@croco/protocols-core",
          "@croco/tasks-core",
          "@croco/telemetry-api",
        ] as const;
        packAll(packageNames, packRoot);

        const tarballs = new Map(
          packageNames.map((packageName) => [
            packageName,
            findPackageTarball(packRoot, packageName),
          ]),
        );
        const engagementCore = tarballs.get("@croco/engagement-core");
        if (engagementCore === undefined) {
          throw new Error("Missing packed engagement-core tarball");
        }
        writeFileSync(
          join(consumerRoot, "package.json"),
          `${JSON.stringify({ name: "engagement-core-consumer", private: true, type: "module" }, null, 2)}\n`,
        );
        writeFileSync(
          join(consumerRoot, "pnpm-workspace.yaml"),
          [
            "packages:",
            "  - .",
            "overrides:",
            ...[...tarballs.entries()]
              .filter(([packageName]) => packageName !== "@croco/engagement-core")
              .map(([packageName, tarball]) => `  '${packageName}': 'file:${tarball}'`),
            "",
          ].join("\n"),
        );
        run(
          "pnpm",
          ["add", "--prod", engagementCore, "zod@3.25.76", "--ignore-scripts"],
          consumerRoot,
        );
        writeConsumerTypecheck(consumerRoot);
        run("node", [tscPath(), "-p", "tsconfig.json"], consumerRoot);
        writeRuntimeConsumers(consumerRoot);
        run("node", ["consumer.mjs"], consumerRoot);
        run("node", ["consumer.cjs"], consumerRoot);
      } finally {
        rmSync(packRoot, { force: true, recursive: true });
        rmSync(consumerRoot, { force: true, recursive: true });
      }
    },
    TEST_TIMEOUT_MS,
  );
});

function ensureBuilt(): void {
  const packages = [
    "diagnostics-core",
    "engagement-core",
    "events-core",
    "execution-core",
    "framework-context",
    "notifications-core",
    "problems-core",
    "protocols-core",
    "tasks-core",
    "telemetry-api",
  ];
  if (packages.every((directory) => existsBuiltPackage(directory))) {
    return;
  }
  run("pnpm", ["--filter", "@croco/engagement-core...", "build"], rootDir);
}

function existsBuiltPackage(directory: string): boolean {
  const packagePath = join(rootDir, "packages", directory);
  const declarationPath = join(packagePath, "dist", "index.d.ts");
  return (
    existsSync(declarationPath) &&
    statSync(declarationPath).mtimeMs >= latestInputModifiedAt(packagePath)
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
    if (!entry.isFile() || !entry.name.endsWith(".ts")) {
      return latest;
    }
    return Math.max(latest, statSync(entryPath).mtimeMs);
  }, 0);
}

function packAll(packageNames: readonly string[], destination: string): void {
  run(
    "pnpm",
    [
      ...packageNames.flatMap((packageName) => ["--filter", packageName]),
      "pack",
      "--pack-destination",
      destination,
    ],
    rootDir,
  );
}

function findTarball(directory: string, prefix: string): string {
  const filename = readdirSync(directory).find(
    (entry) => entry.startsWith(prefix) && entry.endsWith(".tgz"),
  );
  if (!filename) {
    throw new Error(`Missing packed tarball with prefix ${prefix}`);
  }
  return join(directory, filename);
}

function findPackageTarball(directory: string, packageName: string): string {
  return findTarball(directory, `${packageName.replace("@", "").replace("/", "-")}-`);
}

function writeConsumerTypecheck(consumerRoot: string): void {
  writeFileSync(
    join(consumerRoot, "contracts.ts"),
    [
      'import { defineMessage, type EngagementService, type MessageContext, type MessageData, type MessageRenderer, Renders } from "@croco/engagement-core";',
      'import { z } from "zod";',
      "",
      "const TrialEnding = defineMessage({",
      '  id: "billing.trial-ending",',
      '  topic: "billing",',
      "  data: z.object({ firstName: z.string(), upgradeUrl: z.string().url() }).strict(),",
      '  channels: ["email", "push"],',
      "});",
      "",
      "@Renders(TrialEnding)",
      "class TrialEndingRenderer implements MessageRenderer<typeof TrialEnding> {",
      "  email({ data }: MessageContext<typeof TrialEnding>) {",
      "    return { subject: data.firstName, html: data.firstName, text: data.firstName };",
      "  }",
      "  push({ data }: MessageContext<typeof TrialEnding>) {",
      "    return { title: data.firstName, body: data.firstName, deepLink: data.upgradeUrl };",
      "  }",
      "}",
      "",
      'const valid: MessageData<typeof TrialEnding> = { firstName: "Ada", upgradeUrl: "https://croco.dev" };',
      "void valid;",
      "// @ts-expect-error missing required data must fail",
      'const missing: MessageData<typeof TrialEnding> = { upgradeUrl: "https://croco.dev" };',
      "void missing;",
      "const extra: MessageData<typeof TrialEnding> = {",
      '  firstName: "Ada",',
      '  upgradeUrl: "https://croco.dev",',
      "  // @ts-expect-error strict message data rejects extras",
      "  extra: true,",
      "};",
      "void extra;",
      "const invalidData: MessageData<typeof TrialEnding> = {",
      "  // @ts-expect-error packed declarations preserve schema field types",
      "  firstName: 1,",
      '  upgradeUrl: "https://croco.dev",',
      "};",
      "void invalidData;",
      "// @ts-expect-error packed declarations preserve fixed channel literals",
      'defineMessage({ id: "invalid", topic: "billing", data: z.object({}), channels: ["slack"] });',
      "// @ts-expect-error packed declarations require every declared renderer method",
      "class MissingChannel implements MessageRenderer<typeof TrialEnding> {",
      "  email({ data }: MessageContext<typeof TrialEnding>) {",
      "    return { subject: data.firstName, html: data.firstName, text: data.firstName };",
      "  }",
      "}",
      "void MissingChannel;",
      "class UndeclaredChannel implements MessageRenderer<typeof TrialEnding> {",
      "  email({ data }: MessageContext<typeof TrialEnding>) {",
      "    return { subject: data.firstName, html: data.firstName, text: data.firstName };",
      "  }",
      "  push({ data }: MessageContext<typeof TrialEnding>) {",
      "    return { title: data.firstName, body: data.firstName };",
      "  }",
      "  // @ts-expect-error packed declarations reject undeclared renderer methods",
      "  sms({ data }: MessageContext<typeof TrialEnding>) { return { body: data.firstName }; }",
      "}",
      "class InvalidContent implements MessageRenderer<typeof TrialEnding> {",
      "  // @ts-expect-error email cannot return push content",
      "  email({ data }: MessageContext<typeof TrialEnding>) { return { title: data.firstName, body: data.firstName }; }",
      "  push({ data }: MessageContext<typeof TrialEnding>) { return { title: data.firstName, body: data.firstName }; }",
      "}",
      "void TrialEndingRenderer; void UndeclaredChannel; void InvalidContent;",
      "declare const engagement: EngagementService;",
      'engagement.send(TrialEnding, { recipient: { tenantId: "tenant-1", userId: "user-1" }, data: valid, key: "subscription-1" });',
      "engagement.send(TrialEnding, {",
      '  recipient: { tenantId: "tenant-1", userId: "user-1" },',
      "  data: valid,",
      '  key: "subscription-1",',
      "  // @ts-expect-error packed facade does not accept provider endpoints",
      '  to: "user@example.com",',
      "});",
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          module: "NodeNext",
          moduleResolution: "NodeNext",
          noEmit: true,
          skipLibCheck: true,
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
  const source = [
    "const { defineMessage, EngagementService, InMemoryMessageRendererResolver, InMemoryRecipientDirectory, MessageRendererRegistry, RegistryEngagementMessageRenderer, Renders } = PACKAGE;",
    "const { z } = ZOD;",
    'const message = defineMessage({ id: "billing.packed", topic: "billing", data: z.object({ name: z.string() }), channels: ["email"] });',
    "class Renderer { email({ data }) { return { subject: data.name, html: data.name, text: data.name }; } }",
    "Renders(message)(Renderer);",
    "const registry = new MessageRendererRegistry();",
    "registry.registerRenderer(Renderer);",
    "registry.registerMessage(message);",
    "registry.bootstrap();",
    'if (registry.parseData(message, { name: "Ada" }).name !== "Ada") throw new Error("packed parse failed");',
    "const resolver = new InMemoryMessageRendererResolver();",
    "resolver.register(message, new Renderer());",
    'const directory = new InMemoryRecipientDirectory([{ recipient: { tenantId: "tenant-1", userId: "user-1" }, email: { id: "email-1", address: "user@example.com" }, push: [] }]);',
    'const dispatcher = { dispatch: async () => ({ executionId: "execution-1" }) };',
    "const engagement = new EngagementService(directory, new RegistryEngagementMessageRenderer(registry, resolver), dispatcher);",
    'engagement.send(message, { recipient: { tenantId: "tenant-1", userId: "user-1" }, data: { name: "Ada" }, key: "message-1" }).then((result) => { if (result.status !== "queued" || result.executionIds[0] !== "execution-1") throw new Error("packed engagement send failed"); });',
  ];
  writeFileSync(
    join(consumerRoot, "consumer.mjs"),
    [
      'import * as PACKAGE from "@croco/engagement-core";',
      'import * as ZOD from "zod";',
      ...source,
      "",
    ].join("\n"),
  );
  writeFileSync(
    join(consumerRoot, "consumer.cjs"),
    [
      'const PACKAGE = require("@croco/engagement-core");',
      'const ZOD = require("zod");',
      ...source,
      "",
    ].join("\n"),
  );
}

function tscPath(): string {
  return join(rootDir, "node_modules", "typescript", "bin", "tsc");
}

function run(command: string, arguments_: readonly string[], cwd: string): void {
  const result = spawnSync(command, arguments_, {
    cwd,
    encoding: "utf8",
    killSignal: "SIGKILL",
    maxBuffer: 64 * 1024 * 1024,
    timeout: spawnTimeoutMs,
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `${command} ${arguments_.join(" ")} failed:\n${result.stdout}\n${result.stderr}`,
    );
  }
}
