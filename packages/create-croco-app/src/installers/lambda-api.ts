import { createHash } from "node:crypto";
import { copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { getPackageVersion } from "../package-version.js";
import { TEMPLATES_DIR } from "../template-path.js";

export function installLambdaApi(targetDir: string, context: Record<string, unknown>): void {
  mergeInto(join(TEMPLATES_DIR, "addons/lambda-api"), targetDir, {
    ...context,
    lambdaTelemetrySecretReference:
      "{{resolve:secretsmanager:${TelemetryHeadersSecretArn}:SecretString:headers}}",
  });
  // The base template already owns lambda.ts; ordinary mergeInto copies preserve it.
  copyFileSync(
    join(TEMPLATES_DIR, "addons/lambda-api/apps/api-server/src/lambda.ts"),
    join(targetDir, "apps/api-server/src/lambda.ts"),
  );
  const apiPath = join(targetDir, "apps/api-server/package.json");
  const api = JSON.parse(readFileSync(apiPath, "utf8"));
  api.main = "./dist/lambda.js";
  api.files = ["dist"];
  writeFileSync(apiPath, `${JSON.stringify(api, null, 2)}\n`);
  const path = join(targetDir, "package.json");
  const pkg = JSON.parse(readFileSync(path, "utf8"));
  Object.assign(pkg.scripts, {
    "lambda:package": "node scripts/package-lambda.mjs",
    "lambda:check": "node scripts/check-lambda-profile.mjs",
    "lambda:lock": "node scripts/check-lambda-profile.mjs --write",
    "lambda:smoke": "node scripts/smoke-lambda.mjs",
  });
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}\n`);
  const mapPath = join(targetDir, "croco.project-map.json");
  const map = JSON.parse(readFileSync(mapPath, "utf8"));
  for (const workspace of map.packageGraph.packages) {
    if (workspace.path === "package.json") workspace.scripts = Object.keys(pkg.scripts).sort();
  }
  for (const command of ["lambda:package", "lambda:check", "lambda:lock", "lambda:smoke"]) {
    map.entrypoints.push({
      kind: "package-script",
      id: `${pkg.name}#${command}`,
      packageName: pkg.name,
      command,
      source: { file: "package.json", symbol: `scripts.${command}` },
    });
  }
  writeFileSync(mapPath, `${JSON.stringify(map, null, 2)}\n`);
  const readme = join(targetDir, "README.md");
  writeFileSync(
    readme,
    `${readFileSync(readme, "utf8")}\n## Lambda HTTP API\n\nSee [the Lambda profile](lambda/README.md) for production dependency packaging, IAM, secrets, invocation fixtures and AWS verification limits. The SPA is deployed separately.\n`,
  );
  const ignore = join(targetDir, ".gitignore");
  writeFileSync(ignore, `${readFileSync(ignore, "utf8")}\n.lambda-package/\n.aws-sam/\n`);
}

export function writeLambdaApiManifest(targetDir: string): void {
  const paths = [
    "lambda/template.json",
    "lambda/README.md",
    "apps/api-server/tsup.config.ts",
    "apps/api-server/src/lambda.ts",
    "apps/api-server/src/app.ts",
    "apps/api-server/src/env.ts",
    "croco-runtime-capability.manifest.json",
    "scripts/check-lambda-profile.mjs",
    "scripts/package-lambda.mjs",
    "scripts/smoke-lambda.mjs",
  ];
  const manifest = {
    schemaVersion: "croco.infrastructure-profile/v1",
    profile: "lambda-api",
    generator: { name: "create-croco-app", version: getPackageVersion() },
    ownership: "generated-until-reviewed-adoption",
    runtimeCapabilityManifest: "croco-runtime-capability.manifest.json",
    build: {
      packageDirectory: ".lambda-package",
      handler: "dist/lambda.handler",
      script: "scripts/package-lambda.mjs",
    },
    configuration: { template: "lambda/template.json" },
    capabilities: {
      http: "configured",
      telemetry: "configured-opt-in",
      persistence: "process-local",
      auth: "gateway-iam",
      queue: "unsupported",
      scheduler: "unsupported",
      deadLetterQueue: "not-applicable-synchronous-http",
    },
    verification: {
      schema: "not-run",
      invocation: "not-run",
      liveAws: "not-verified",
      certification: "not-certified",
    },
    files: paths.sort().map((path) => ({
      path,
      sha256: createHash("sha256")
        .update(readFileSync(join(targetDir, path)))
        .digest("hex"),
    })),
  };
  writeFileSync(
    join(targetDir, "croco-infrastructure-profile.manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
}
