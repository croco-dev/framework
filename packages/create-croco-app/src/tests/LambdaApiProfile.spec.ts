import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      CodeUri: "../.lambda-package/",
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
