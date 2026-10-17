import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseAllDocuments } from "yaml";
import { generate } from "../generator.js";
import { normalizeNonInteractiveOptions } from "../options.js";

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});
const input = {
  projectName: "node-api",
  scope: "@example",
  preset: "production-app",
  backendDeploy: "kubernetes",
  installDeps: false,
  initGit: false,
  agentRules: false,
} as const;

describe("Kubernetes Node API profile", () => {
  it("generates matching probe, port, config/secret, security and runtime contracts without cluster services", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-k8s-"));
    roots.push(root);
    const target = join(root, "app");
    const result = await generate(target, normalizeNonInteractiveOptions(input));
    const resources = parseAllDocuments(
      readFileSync(join(target, "kubernetes/resources.yaml"), "utf8"),
    ).map((document) => document.toJSON());
    const deployment = resources.find((resource) => resource.kind === "Deployment");
    const service = resources.find((resource) => resource.kind === "Service");
    const config = resources.find((resource) => resource.kind === "ConfigMap");
    const pod = deployment.spec.template.spec;
    const container = pod.containers[0];
    expect(config.data.PORT).toBe("3000");
    expect(container.ports).toEqual([{ name: "http", containerPort: 3000 }]);
    expect(container.readinessProbe.httpGet).toEqual({ path: "/health/ready", port: "http" });
    expect(container.livenessProbe.httpGet).toEqual({ path: "/health/live", port: "http" });
    expect(container.startupProbe.httpGet).toEqual({ path: "/health/live", port: "http" });
    expect(service.spec.ports[0]).toEqual({ name: "http", port: 80, targetPort: "http" });
    expect(service.spec.selector).toEqual(deployment.spec.template.metadata.labels);
    expect(deployment.spec.selector.matchLabels).toEqual(service.spec.selector);
    expect(container.envFrom).toEqual([
      { configMapRef: { name: "croco-api-config" } },
      { secretRef: { name: "croco-api-secrets", optional: true } },
    ]);
    expect(pod).toMatchObject({
      automountServiceAccountToken: false,
      terminationGracePeriodSeconds: 120,
      securityContext: {
        runAsNonRoot: true,
        runAsUser: 1001,
        seccompProfile: { type: "RuntimeDefault" },
      },
    });
    expect(container.securityContext).toMatchObject({
      readOnlyRootFilesystem: true,
      allowPrivilegeEscalation: false,
      capabilities: { drop: ["ALL"] },
    });
    expect(container.resources).toEqual({
      requests: { cpu: "100m", memory: "128Mi" },
      limits: { cpu: "1", memory: "512Mi" },
    });
    expect(resources.map((r) => r.kind).sort()).toEqual(["ConfigMap", "Deployment", "Service"]);
    expect(deployment.spec.replicas).toBe(1);
    expect(existsSync(join(target, "docker-compose.yml"))).toBe(false);
    const runtime = JSON.parse(
      readFileSync(join(target, "croco-runtime-capability.manifest.json"), "utf8"),
    );
    expect(JSON.stringify(runtime)).toContain("@croco/preset-node");
    expect(JSON.stringify(runtime)).toContain("node-container");
    expect(readFileSync(join(target, "apps/api-server/Dockerfile"), "utf8")).toContain(
      'CMD ["node", "apps/api-server/dist/kubernetes.js"]',
    );
    const projectMap = JSON.parse(readFileSync(join(target, "croco.project-map.json"), "utf8"));
    for (const command of ["k8s:check", "k8s:lock", "k8s:smoke"]) {
      expect(projectMap.entrypoints).toContainEqual({
        kind: "package-script",
        id: `node-api#${command}`,
        packageName: "node-api",
        command,
        source: { file: "package.json", symbol: `scripts.${command}` },
      });
      expect(
        projectMap.packageGraph.packages.find(
          (pkg: { path: string }) => pkg.path === "package.json",
        ).scripts,
      ).toContain(command);
    }
    const manifest = JSON.parse(
      readFileSync(join(target, "croco-infrastructure-profile.manifest.json"), "utf8"),
    );
    expect(manifest.verification.liveCluster).toBe("not-verified");
    expect(manifest.verification.certification).toBe("not-certified");
    expect(result.artifacts).toContainEqual({
      kind: "infrastructure-profile",
      path: "croco-infrastructure-profile.manifest.json",
    });
    const check = () =>
      spawnSync(process.execPath, ["scripts/check-kubernetes-profile.mjs"], {
        cwd: target,
        encoding: "utf8",
      });
    expect(check().status).toBe(0);
    const ownedPaths = manifest.files.map((file: { path: string }) => file.path);
    expect(ownedPaths).toContain("apps/api-server/src/node-application.ts");
    expect(ownedPaths).not.toContain("apps/api-server/src/users.ts");
    expect(ownedPaths).not.toContain("apps/console-web/src/App.tsx");
    for (const path of [
      "apps/api-server/src/users.ts",
      "apps/console-web/src/App.tsx",
      "package.json",
    ]) {
      const source = join(target, path);
      writeFileSync(source, `${readFileSync(source, "utf8")}\n`);
    }
    expect(check().status).toBe(0);
    // Mutable settings have one authority: the referenced artifact, not copied metadata.
    expect(manifest.build).toEqual({
      dockerfile: "apps/api-server/Dockerfile",
      buildConfig: "apps/api-server/tsup.config.ts",
    });
    expect(manifest.configuration).toEqual({ resourceFile: "kubernetes/resources.yaml" });
    const resourcePath = join(target, manifest.configuration.resourceFile);
    writeFileSync(
      resourcePath,
      readFileSync(resourcePath, "utf8").replace(
        "croco-api:local",
        "registry.example.com/api@sha256:reviewed",
      ),
    );
    const drift = check();
    expect(drift.status).not.toBe(0);
    expect(drift.stderr).toContain("Profile drift: kubernetes/resources.yaml");
    expect(
      spawnSync(process.execPath, ["scripts/check-kubernetes-profile.mjs", "--write"], {
        cwd: target,
      }).status,
    ).toBe(0);
    expect(check().status).toBe(0);
    rmSync(resourcePath);
    const missing = check();
    expect(missing.status).not.toBe(0);
    expect(missing.stderr).toContain("Profile file missing: kubernetes/resources.yaml");
    const beforeAdoption = readFileSync(
      join(target, "croco-infrastructure-profile.manifest.json"),
      "utf8",
    );
    const adoption = spawnSync(
      process.execPath,
      ["scripts/check-kubernetes-profile.mjs", "--write"],
      {
        cwd: target,
        encoding: "utf8",
      },
    );
    expect(adoption.status).not.toBe(0);
    expect(adoption.stderr).toContain("Profile file missing: kubernetes/resources.yaml");
    expect(readFileSync(join(target, "croco-infrastructure-profile.manifest.json"), "utf8")).toBe(
      beforeAdoption,
    );
  });

  it.each([
    "ddd-api",
    "ddd-fullstack",
    "ddd-vike-fullstack",
    "admin-console",
    "saas",
    "blank",
  ] as const)("rejects unsupported %s compositions before writing", (preset) => {
    expect(() => normalizeNonInteractiveOptions({ ...input, preset })).toThrow(
      "Kubernetes requires --preset production-app",
    );
  });

  it("rejects goal compositions before writing", () => {
    expect(() => normalizeNonInteractiveOptions({ ...input, goal: "spa-backend-split" })).toThrow(
      "--preset, --backend-deploy cannot be combined with --goal spa-backend-split",
    );
  });

  it("retains the existing production-app default without claiming Kubernetes compatibility", async () => {
    const root = mkdtempSync(join(tmpdir(), "croco-node-"));
    roots.push(root);
    const target = join(root, "app");
    await generate(target, normalizeNonInteractiveOptions({ ...input, backendDeploy: undefined }));
    expect(existsSync(join(target, "kubernetes/resources.yaml"))).toBe(false);
    expect(existsSync(join(target, "croco-infrastructure-profile.manifest.json"))).toBe(false);
  });
});
