import { createHash } from "node:crypto";
import { copyFileSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mergeInto } from "../helpers/fs.js";
import { getPackageVersion } from "../package-version.js";
import { TEMPLATES_DIR } from "../template-path.js";

export function installKubernetes(targetDir: string, context: Record<string, unknown>): void {
  mergeInto(join(TEMPLATES_DIR, "addons/kubernetes"), targetDir, context);
  // Keep the existing Docker prune/build pipeline without installing Compose's database.
  copyFileSync(
    join(TEMPLATES_DIR, "addons/docker/.dockerignore"),
    join(targetDir, ".dockerignore"),
  );
  const ignorePath = join(targetDir, ".dockerignore");
  writeFileSync(
    ignorePath,
    `${readFileSync(ignorePath, "utf8")}\n.git\n.env\n**/.env\n.env.*\n**/.env.*\n!.env.example\n!**/.env.example\n*.pem\n**/*.pem\n*.key\n**/*.key\n`,
  );
  const buildPath = join(targetDir, "apps/api-server/tsup.config.ts");
  writeFileSync(
    buildPath,
    readFileSync(buildPath, "utf8").replace(
      '"src/lambda.ts"',
      '"src/lambda.ts", "src/kubernetes.ts"',
    ),
  );
  const readmePath = join(targetDir, "README.md");
  writeFileSync(
    readmePath,
    `${readFileSync(readmePath, "utf8")}\n## Kubernetes Node API\n\nSee [the deployment profile](kubernetes/README.md) for build, schema, drift and live-cluster verification. This profile is not cluster-certified.\n`,
  );
  const packagePath = join(targetDir, "package.json");
  const pkg = JSON.parse(readFileSync(packagePath, "utf8"));
  pkg.scripts["k8s:check"] = "node scripts/check-kubernetes-profile.mjs";
  pkg.scripts["k8s:smoke"] = "node scripts/smoke-kubernetes.mjs";
  pkg.scripts["k8s:lock"] = "node scripts/check-kubernetes-profile.mjs --write";
  writeFileSync(packagePath, `${JSON.stringify(pkg, null, 2)}\n`);
  const mapPath = join(targetDir, "croco.project-map.json");
  const projectMap = JSON.parse(readFileSync(mapPath, "utf8"));
  const commands = ["k8s:check", "k8s:lock", "k8s:smoke"];
  for (const workspacePackage of projectMap.packageGraph.packages) {
    if (workspacePackage.path === "package.json")
      workspacePackage.scripts = Object.keys(pkg.scripts).sort();
  }
  projectMap.entrypoints.push(
    ...commands.map((command) => ({
      kind: "package-script",
      id: `${pkg.name}#${command}`,
      packageName: pkg.name,
      command,
      source: { file: "package.json", symbol: `scripts.${command}` },
    })),
  );
  writeFileSync(mapPath, `${JSON.stringify(projectMap, null, 2)}\n`);
}

export function writeKubernetesProfileManifest(targetDir: string): void {
  const generatedPaths = (directory: string, prefix = ""): string[] =>
    readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      return entry.isDirectory() ? generatedPaths(join(directory, entry.name), path) : [path];
    });
  const files = generatedPaths(targetDir)
    .sort()
    .map((path) => ({
      path,
      sha256: createHash("sha256")
        .update(readFileSync(join(targetDir, path)))
        .digest("hex"),
    }));
  writeFileSync(
    join(targetDir, "croco-infrastructure-profile.manifest.json"),
    `${JSON.stringify(
      {
        schemaVersion: "croco.infrastructure-profile/v1",
        profile: "kubernetes-node-api",
        generator: { name: "create-croco-app", version: getPackageVersion() },
        ownership: "generated-until-reviewed-adoption",
        runtimeCapabilityManifest: "croco-runtime-capability.manifest.json",
        // Record canonical artifact locations, not copies of mutable deployment settings.
        // Reviewed adoption updates their hashes, so image/port/budget edits have one authority.
        build: {
          dockerfile: "apps/api-server/Dockerfile",
          buildConfig: "apps/api-server/tsup.config.ts",
        },
        configuration: { resourceFile: "kubernetes/resources.yaml" },
        termination: {
          applicationLifecycleSource: "apps/api-server/src/kubernetes.ts",
          nodeLifecycleSource: "apps/api-server/src/node-application.ts",
          resourceFile: "kubernetes/resources.yaml",
        },
        verification: {
          schema: "not-run",
          nodeHost: "not-run",
          liveCluster: "not-verified",
          certification: "not-certified",
        },
        files,
      },
      null,
      2,
    )}\n`,
  );
}
