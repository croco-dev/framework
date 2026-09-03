import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import {
  generateDesktopMainRegistrationMetadata,
  generateDesktopPreloadBridges,
  generateDesktopRendererClients,
  stringifyDesktopMainRegistrationMetadata,
} from "@croco/desktop-codegen";
import { stringifyDesktopContractGraph } from "@croco/protocols-desktop";
import type { DesktopContractGraphV1 } from "@croco/protocols-desktop";

const CONTRACT_GRAPH_PATH = "desktop-contract-graph.json";
const MAIN_REGISTRATION_PATH = "desktop-main-registration.json";
const MANAGED_SOURCE_PATH = /^(?:preload|renderer)\/window-[a-f0-9]{64}\.generated\.ts$/;

export class DesktopArtifactError extends Error {
  readonly code:
    | "CROCO_DESKTOP_ARTIFACT_IO_FAILED"
    | "CROCO_DESKTOP_ARTIFACT_PATH_ESCAPE"
    | "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID"
    | "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK"
    | "CROCO_DESKTOP_ARTIFACT_PATH_UNSUPPORTED"
    | "CROCO_DESKTOP_ARTIFACT_SET_INVALID";
  readonly recovery: string;

  constructor(code: DesktopArtifactError["code"], message: string, recovery: string) {
    super(message);
    this.name = "DesktopArtifactError";
    this.code = code;
    this.recovery = recovery;
  }
}

export type DesktopGeneratedArtifact = {
  readonly relativePath: string;
  readonly content: string;
};

export type DesktopArtifactDriftKind = "missing" | "modified" | "stale";

export type DesktopArtifactDrift = {
  readonly kind: DesktopArtifactDriftKind;
  readonly relativePath: string;
  readonly expectedHash?: `sha256:${string}`;
  readonly actualHash?: `sha256:${string}`;
};

export type DesktopArtifactWriteResult = {
  readonly written: readonly string[];
  readonly removed: readonly string[];
};

export function createDesktopGeneratedArtifacts(
  graph: DesktopContractGraphV1,
): readonly DesktopGeneratedArtifact[] {
  const preloads = generateDesktopPreloadBridges(graph);
  const renderers = generateDesktopRendererClients(graph);
  const main = generateDesktopMainRegistrationMetadata(graph);
  const artifacts = [
    { relativePath: CONTRACT_GRAPH_PATH, content: stringifyDesktopContractGraph(graph) },
    ...preloads.map(({ relativePath, source }) => ({ relativePath, content: source })),
    ...renderers.map(({ relativePath, source }) => ({ relativePath, content: source })),
    {
      relativePath: MAIN_REGISTRATION_PATH,
      content: stringifyDesktopMainRegistrationMetadata(main),
    },
  ].sort((left, right) => compareCodeUnits(left.relativePath, right.relativePath));

  for (const artifact of artifacts) {
    assertManagedDesktopArtifactPath(artifact.relativePath);
  }

  return artifacts;
}

export function inspectDesktopArtifactDrift(
  outputDirectory: string,
  expectedArtifacts: readonly DesktopGeneratedArtifact[],
): readonly DesktopArtifactDrift[] {
  try {
    return inspectDesktopArtifactDriftUnchecked(outputDirectory, expectedArtifacts);
  } catch (error) {
    throw toDesktopArtifactError(error, outputDirectory);
  }
}

function inspectDesktopArtifactDriftUnchecked(
  outputDirectory: string,
  expectedArtifacts: readonly DesktopGeneratedArtifact[],
): readonly DesktopArtifactDrift[] {
  const expectedByPath = new Map(
    expectedArtifacts.map((artifact) => [artifact.relativePath, artifact] as const),
  );
  const drift: DesktopArtifactDrift[] = [];

  for (const artifact of expectedArtifacts) {
    const path = resolveDesktopArtifactPath(outputDirectory, artifact.relativePath);
    if (!assertReadableManagedPath(outputDirectory, artifact.relativePath)) {
      drift.push({
        kind: "missing",
        relativePath: artifact.relativePath,
        expectedHash: hashContent(artifact.content),
      });
      continue;
    }

    const actual = readFileSync(path, "utf8");
    if (actual !== artifact.content) {
      drift.push({
        kind: "modified",
        relativePath: artifact.relativePath,
        expectedHash: hashContent(artifact.content),
        actualHash: hashContent(actual),
      });
    }
  }

  for (const relativePath of listManagedDesktopArtifactPaths(outputDirectory)) {
    if (!expectedByPath.has(relativePath)) {
      drift.push({
        kind: "stale",
        relativePath,
        actualHash: hashContent(
          readFileSync(resolveDesktopArtifactPath(outputDirectory, relativePath), "utf8"),
        ),
      });
    }
  }

  return drift.sort((left, right) =>
    compareCodeUnits(`${left.kind}:${left.relativePath}`, `${right.kind}:${right.relativePath}`),
  );
}

export function writeDesktopGeneratedArtifacts(
  outputDirectory: string,
  artifacts: readonly DesktopGeneratedArtifact[],
): DesktopArtifactWriteResult {
  try {
    return writeDesktopGeneratedArtifactsUnchecked(outputDirectory, artifacts);
  } catch (error) {
    throw toDesktopArtifactError(error, outputDirectory);
  }
}

function writeDesktopGeneratedArtifactsUnchecked(
  outputDirectory: string,
  artifacts: readonly DesktopGeneratedArtifact[],
): DesktopArtifactWriteResult {
  const currentPaths = new Set(artifacts.map((artifact) => artifact.relativePath));
  const stalePaths = listManagedDesktopArtifactPaths(outputDirectory).filter(
    (relativePath) => !currentPaths.has(relativePath),
  );
  const mainArtifact = artifacts.find(
    (artifact) => artifact.relativePath === MAIN_REGISTRATION_PATH,
  );
  if (!mainArtifact) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_SET_INVALID",
      `Desktop artifacts must include ${MAIN_REGISTRATION_PATH}.`,
      "Rebuild @croco/cli so it produces the complete desktop artifact set.",
    );
  }

  for (const artifact of artifacts) {
    assertWritableManagedPath(outputDirectory, artifact.relativePath);
  }
  for (const stalePath of stalePaths) {
    assertWritableManagedPath(outputDirectory, stalePath);
  }

  const contentArtifacts = artifacts.filter(
    (artifact) => artifact.relativePath !== MAIN_REGISTRATION_PATH,
  );
  for (const artifact of contentArtifacts) {
    writeArtifact(outputDirectory, artifact);
  }
  for (const stalePath of stalePaths) {
    rmSync(resolveDesktopArtifactPath(outputDirectory, stalePath));
  }
  writeArtifact(outputDirectory, mainArtifact);

  return {
    written: artifacts.map((artifact) => artifact.relativePath).sort(compareCodeUnits),
    removed: stalePaths.sort(compareCodeUnits),
  };
}

export function resolveDesktopArtifactPath(outputDirectory: string, relativePath: string): string {
  assertManagedDesktopArtifactPath(relativePath);
  const root = resolve(outputDirectory);
  const path = resolve(root, relativePath);
  const fromRoot = relative(root, path);
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`) || isAbsolute(fromRoot)) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_ESCAPE",
      `Desktop generated path escapes its output directory: ${relativePath}`,
      `Choose an output directory that contains '${relativePath}'.`,
    );
  }
  return path;
}

function writeArtifact(outputDirectory: string, artifact: DesktopGeneratedArtifact): void {
  const path = resolveDesktopArtifactPath(outputDirectory, artifact.relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, artifact.content);
}

function listManagedDesktopArtifactPaths(outputDirectory: string): string[] {
  if (!pathStat(outputDirectory)) return [];
  assertDirectory(outputDirectory, "desktop output directory");
  const paths = [CONTRACT_GRAPH_PATH, MAIN_REGISTRATION_PATH].filter((relativePath) =>
    pathStat(resolveDesktopArtifactPath(outputDirectory, relativePath)),
  );

  for (const surface of ["preload", "renderer"] as const) {
    const directory = resolve(outputDirectory, surface);
    if (!pathStat(directory)) continue;
    assertDirectory(directory, `desktop ${surface} artifact directory`);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const relativePath = `${surface}/${entry.name}`;
      if (!MANAGED_SOURCE_PATH.test(relativePath)) continue;
      assertRegularFile(resolve(outputDirectory, relativePath));
      paths.push(relativePath);
    }
  }

  return paths.sort(compareCodeUnits);
}

function assertManagedDesktopArtifactPath(relativePath: string): void {
  if (
    relativePath !== CONTRACT_GRAPH_PATH &&
    relativePath !== MAIN_REGISTRATION_PATH &&
    !MANAGED_SOURCE_PATH.test(relativePath)
  ) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_UNSUPPORTED",
      `Unsupported desktop generated path: ${relativePath}`,
      "Rebuild @croco/cli so it emits only supported desktop artifact paths.",
    );
  }
}

function assertReadableManagedPath(outputDirectory: string, relativePath: string): boolean {
  const root = resolve(outputDirectory);
  if (!pathStat(root)) return false;
  assertDirectory(root, "desktop output directory");

  const segments = relativePath.split("/");
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    if (!pathStat(current)) return false;
    if (index < segments.length - 1) assertDirectory(current, "desktop artifact directory");
    else assertRegularFile(current);
  }
  return true;
}

function assertWritableManagedPath(outputDirectory: string, relativePath: string): void {
  const root = resolve(outputDirectory);
  if (pathStat(root)) assertDirectory(root, "desktop output directory");

  const segments = relativePath.split("/");
  let current = root;
  for (const [index, segment] of segments.entries()) {
    current = resolve(current, segment);
    if (!pathStat(current)) continue;
    if (index < segments.length - 1) {
      assertDirectory(current, "desktop artifact directory");
      continue;
    }
    assertRegularFile(current);
  }
}

function assertDirectory(path: string, label: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK",
      `The ${label} must not be a symbolic link: ${path}`,
      `Replace '${path}' with an ordinary directory.`,
    );
  }
  if (!stat.isDirectory()) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID",
      `The ${label} is not a directory: ${path}`,
      `Replace '${path}' with an ordinary directory.`,
    );
  }
}

function assertRegularFile(path: string): void {
  const stat = lstatSync(path);
  if (stat.isSymbolicLink()) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_SYMLINK",
      `Desktop artifact target must not be a symbolic link: ${path}`,
      `Replace '${path}' with an ordinary file.`,
    );
  }
  if (!stat.isFile()) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID",
      `Desktop artifact target is not a regular file: ${path}`,
      `Replace '${path}' with an ordinary file.`,
    );
  }
  if (stat.nlink > 1) {
    throw new DesktopArtifactError(
      "CROCO_DESKTOP_ARTIFACT_PATH_KIND_INVALID",
      `Desktop artifact target has multiple filesystem links: ${path}`,
      `Replace '${path}' with an ordinary file.`,
    );
  }
}

function toDesktopArtifactError(error: unknown, outputDirectory: string): DesktopArtifactError {
  if (error instanceof DesktopArtifactError) return error;
  return new DesktopArtifactError(
    "CROCO_DESKTOP_ARTIFACT_IO_FAILED",
    error instanceof Error ? error.message : String(error),
    `Make '${resolve(outputDirectory)}' readable and writable.`,
  );
}

function pathStat(path: string): ReturnType<typeof lstatSync> | undefined {
  return lstatSync(path, { throwIfNoEntry: false });
}

function hashContent(content: string): `sha256:${string}` {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
