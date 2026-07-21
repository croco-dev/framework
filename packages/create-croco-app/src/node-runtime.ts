import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { VERSIONS } from "./consts.js";
import { UnsupportedNodeVersionProblem } from "./libs/problems/UnsupportedNodeVersionProblem.js";

export const GENERATED_NODE_VERSION = VERSIONS.node;
export const GENERATED_NODE_ENGINE_RANGE = `>=${GENERATED_NODE_VERSION}`;

export function assertSupportedNodeVersion(actualVersion = process.versions.node): void {
  const actualMajor = readNodeMajor(actualVersion);
  const minimumMajor = readNodeMajor(GENERATED_NODE_VERSION);

  if (actualMajor < minimumMajor) {
    throw new UnsupportedNodeVersionProblem(actualVersion, GENERATED_NODE_VERSION);
  }
}

export function writeGeneratedNodeRuntimeContract(projectDir: string): void {
  const packageJsonPath = join(projectDir, "package.json");
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as Record<string, unknown>;

  packageJson["engines"] = {
    ...readRecord(packageJson["engines"]),
    node: GENERATED_NODE_ENGINE_RANGE,
  };

  writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
  writeFileSync(join(projectDir, ".nvmrc"), `${GENERATED_NODE_VERSION}\n`);
  appendGeneratedNodeGuidance(join(projectDir, "README.md"));
}

function readNodeMajor(version: string): number {
  const match = /^(?:v)?(\d+)(?:\.|$)/.exec(version);
  const major = match ? Number(match[1]) : Number.NaN;

  if (!Number.isInteger(major)) {
    throw new UnsupportedNodeVersionProblem(version, GENERATED_NODE_VERSION);
  }

  return major;
}

function readRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function appendGeneratedNodeGuidance(readmePath: string): void {
  const readme = readFileSync(readmePath, "utf8").trimEnd();
  const guidance = [
    "## Node.js Requirement",
    "",
    `Dependency installation and builds require Node.js ${GENERATED_NODE_ENGINE_RANGE}. The generated \`.nvmrc\` pins Node.js ${GENERATED_NODE_VERSION}.`,
    "This tooling requirement does not change the deployment runtime recorded in `croco-runtime-capability.manifest.json`; browser and Cloudflare Workers outputs still deploy without a Node.js runtime.",
    "",
    "If `node --version` is unsupported, run:",
    "",
    "```bash",
    `nvm install ${GENERATED_NODE_VERSION}`,
    `nvm use ${GENERATED_NODE_VERSION}`,
    "```",
  ].join("\n");

  writeFileSync(readmePath, `${readme}\n\n${guidance}\n`);
}
