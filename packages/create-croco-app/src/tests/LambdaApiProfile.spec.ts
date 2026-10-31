import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const input = {
  projectName: "lambda-api",
  scope: "@example",
  preset: "production-app",
  backendDeploy: "lambda",
  installDeps: false,
  initGit: false,
  agentRules: false,
} as const;

describe("Lambda API infrastructure profile", () => {
  async function packagingFixture() {
    const root = mkdtempSync(join(tmpdir(), "croco-lambda-package-"));
    roots.push(root);
    const target = join(root, "app with spaces");
    await generate(target, normalizeNonInteractiveOptions(input));
    const bin = join(root, "bin with spaces");
    mkdirSync(bin);
    const fakePnpm = join(bin, "pnpm");
    const pnpmCli = join(bin, "pnpm.mjs");
    writeFileSync(
      pnpmCli,
      `import { appendFileSync, existsSync } from 'node:fs';
const args = process.argv.slice(2);
const command = args[2];
appendFileSync('commands.jsonl', JSON.stringify({ args, cwd: process.cwd(), oldPackage: existsSync('dist/lambda-package/previous.txt') }) + '\\n');
if (command === process.env.FAIL_COMMAND) {
  if (process.env.FAIL_SIGNAL) process.kill(process.pid, 'SIGTERM');
  else process.exit(Number(process.env.FAIL_STATUS));
}
`,
    );
    const quote = (path: string) => `'${path.replaceAll("'", "'\\''")}'`;
    writeFileSync(fakePnpm, `#!/bin/sh\nexec ${quote(process.execPath)} ${quote(pnpmCli)} "$@"\n`, {
      mode: 0o755,
    });
    const previous = join(target, "dist/lambda-package/previous.txt");
    mkdirSync(join(target, "dist/lambda-package"), { recursive: true });
    writeFileSync(previous, "previous deployment");
    return {
      target: realpathSync(target),
      previous,
      run: (env: Record<string, string> = {}) =>
        spawnSync(process.execPath, [join(target, "scripts/package-lambda.mjs")], {
          cwd: root,
          env: {
            ...process.env,
            PATH: bin,
            npm_execpath: process.platform === "win32" ? pnpmCli : "",
            ...env,
          },
          encoding: "utf8",
          timeout: 10_000,
        }),
      commands: () =>
        readFileSync(join(target, "commands.jsonl"), "utf8")
          .trim()
          .split("\n")
          .map((line) => JSON.parse(line)),
      pnpmCli,
      pnpmExecutable: fakePnpm,
    };
  }

  it("packages with installed pnpm and no Corepack, building before replacing the deployment", async () => {
    const fixture = await packagingFixture();
    const result = fixture.run();
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.commands()).toEqual([
      { args: ["--filter", "@example/api-server", "build"], cwd: fixture.target, oldPackage: true },
      {
        args: ["--filter", "@example/api-server", "deploy", "--prod", "dist/lambda-package"],
        cwd: fixture.target,
        oldPackage: false,
      },
    ]);
    expect(existsSync(fixture.previous)).toBe(false);
  });

  it("reuses the invoking pnpm CLI path without a shell or a PATH launcher", async () => {
    const fixture = await packagingFixture();
    const emptyBin = join(fixture.target, "empty-bin");
    mkdirSync(emptyBin);
    const result = fixture.run({ PATH: emptyBin, npm_execpath: fixture.pnpmCli });
    expect(result.error).toBeUndefined();
    expect(result.status, result.stderr).toBe(0);
    expect(fixture.commands().map(({ args }) => args)).toEqual([
      ["--filter", "@example/api-server", "build"],
      ["--filter", "@example/api-server", "deploy", "--prod", "dist/lambda-package"],
    ]);
  });

  it.runIf(process.platform !== "win32")(
    "executes a standalone pnpm launcher instead of parsing it as JavaScript",
    async () => {
      const fixture = await packagingFixture();
      const emptyBin = join(fixture.target, "empty-bin");
      mkdirSync(emptyBin);
      const result = fixture.run({ PATH: emptyBin, npm_execpath: fixture.pnpmExecutable });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      expect(fixture.commands().map(({ args }) => args[2])).toEqual(["build", "deploy"]);
    },
  );

  it.each(["build", "deploy"])(
    "propagates a failed %s without reporting packaging success",
    async (command) => {
      const fixture = await packagingFixture();
      const result = fixture.run({ FAIL_COMMAND: command, FAIL_STATUS: "23" });
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(23);
      expect(fixture.commands().map(({ args }) => args[2])).toEqual(
        command === "build" ? ["build"] : ["build", "deploy"],
      );
      expect(existsSync(fixture.previous)).toBe(command === "build");
      expect(result.stdout).not.toContain("Lambda deployment directory prepared");
    },
  );

  it("fails before removing the previous deployment when pnpm is unavailable", async () => {
    const fixture = await packagingFixture();
    const emptyBin = join(fixture.target, "empty-bin");
    mkdirSync(emptyBin);
    const result = fixture.run({ PATH: emptyBin, npm_execpath: "" });
    expect(result.error).toBeUndefined();
    expect(result.status).not.toBe(0);
    expect(readFileSync(fixture.previous, "utf8")).toBe("previous deployment");
    expect(existsSync(join(fixture.target, "commands.jsonl"))).toBe(false);
    expect(result.stdout).not.toContain("Lambda deployment directory prepared");
  });

  it.runIf(process.platform !== "win32")(
    "fails safely when the build subprocess is terminated by a signal",
    async () => {
      const fixture = await packagingFixture();
      const result = fixture.run({ FAIL_COMMAND: "build", FAIL_SIGNAL: "1" });
      expect(result.error).toBeUndefined();
      expect(result.status).toBe(1);
      expect(fixture.commands()).toHaveLength(1);
      expect(readFileSync(fixture.previous, "utf8")).toBe("previous deployment");
      expect(result.stdout).not.toContain("Lambda deployment directory prepared");
    },
  );

  it("generates an IAM-protected HTTP API with bounded execution and matching host/package metadata", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-lambda-api-"));
    roots.push(root);
    const result = await generate(join(root, "app"), normalizeNonInteractiveOptions(input));
    const target = join(root, "app");
    const read = (path: string) => JSON.parse(readFileSync(join(target, path), "utf8"));
    const template = read("lambda/template.json");
    expect(template.Transform).toBe("AWS::Serverless-2016-10-31");
    expect(template.Resources.HttpApi.Properties.Auth).toEqual({
      DefaultAuthorizer: "AWS_IAM",
      EnableIamAuthorizer: true,
    });
    const fn = template.Resources.ApiFunction.Properties;
    expect(fn).toMatchObject({
      Runtime: "nodejs24.x",
      Handler: "dist/lambda.handler",
      CodeUri: "../dist/lambda-package/",
      Timeout: 30,
      ReservedConcurrentExecutions: 1,
    });
    expect(fn.Events.Api.Properties).toMatchObject({
      ApiId: { Ref: "HttpApi" },
      Path: "/{proxy+}",
      Method: "ANY",
      PayloadFormatVersion: "2.0",
    });
    expect(fn.Environment.Variables.OTEL_EXPORTER_OTLP_HEADERS).toEqual({
      "Fn::If": [
        "HasTelemetryHeaders",
        {
          "Fn::Sub": "{{resolve:secretsmanager:${TelemetryHeadersSecretArn}:SecretString:headers}}",
        },
        { Ref: "AWS::NoValue" },
      ],
    });
    expect(fn.Role).toEqual({ "Fn::GetAtt": ["ApiRole", "Arn"] });
    const statements = template.Resources.ApiRole.Properties.Policies.flatMap(
      (policy: { PolicyDocument: { Statement: unknown[] } }) => policy.PolicyDocument.Statement,
    );
    expect(statements).toEqual([
      expect.objectContaining({
        Action: ["logs:CreateLogStream", "logs:PutLogEvents"],
        Resource: expect.any(Object),
      }),
    ]);
    expect(template.Parameters.ExecutionRoleArn).toBeUndefined();
    expect(read("croco-runtime-capability.manifest.json")).toMatchObject({
      platform: "lambda",
      composition: {
        host: { packageName: "@croco/preset-lambda", lifecycle: "invocation" },
        buildTarget: { name: "lambda-function", format: "cjs" },
      },
    });
    expect(result.artifacts).toContainEqual({
      kind: "infrastructure-profile",
      path: "croco-infrastructure-profile.manifest.json",
    });
    const manifest = read("croco-infrastructure-profile.manifest.json");
    expect(manifest.verification).toMatchObject({
      liveAws: "not-verified",
      certification: "not-certified",
    });
    const check = (...args: string[]) =>
      spawnSync(process.execPath, ["scripts/check-lambda-profile.mjs", ...args], {
        cwd: target,
        encoding: "utf8",
      });
    expect(check().status).toBe(0);
    const rootPackage = read("package.json");
    const rootBytes = readFileSync(join(target, "package.json"), "utf8");
    rootPackage.scripts["lambda:package"] = "echo skipped";
    writeFileSync(join(target, "package.json"), JSON.stringify(rootPackage));
    expect(check().status).not.toBe(0);
    writeFileSync(join(target, "package.json"), rootBytes);
    const owned = join(target, "lambda/template.json");
    writeFileSync(owned, `${readFileSync(owned, "utf8")}\n`);
    expect(check().status).not.toBe(0);
    expect(check("--write").status).toBe(0);
    expect(check().status).toBe(0);
    const before = readFileSync(join(target, "croco-infrastructure-profile.manifest.json"), "utf8");
    rmSync(owned);
    expect(check("--write").status).not.toBe(0);
    expect(readFileSync(join(target, "croco-infrastructure-profile.manifest.json"), "utf8")).toBe(
      before,
    );
  });
});
