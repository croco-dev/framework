import { readFileSync, writeFileSync } from "node:fs";
import { compileFunction } from "node:vm";

import * as zod from "zod";
import * as zodV4Core from "zod/v4/core";

import * as problemsCore from "@croco/problems-core";
import * as protocolsDesktop from "@croco/protocols-desktop";
import type { PackageProblemRegistry } from "@croco/problems-core";
import type {
  DesktopAppDefinition,
  DesktopContractRecord,
  DesktopWindowRecord,
} from "@croco/protocols-desktop";

const CONFIG_VERSION = "croco.desktop-config.v1";
const PROTOCOL_VERSION = "croco.desktop-config-worker.v1";

class DesktopConfigValidationError extends Error {
  readonly code = "CROCO_DESKTOP_CONFIG_INVALID";

  constructor(message: string) {
    super(message);
    this.name = "DesktopConfigValidationError";
  }
}

type WorkerConfig = {
  readonly version: typeof CONFIG_VERSION;
  readonly app: DesktopAppDefinition<DesktopContractRecord, DesktopWindowRecord>;
  readonly problemRegistries?: readonly PackageProblemRegistry[];
};

const configPath = process.argv[2];

try {
  if (!configPath) {
    throw new DesktopConfigValidationError(
      "Desktop config worker requires a config path argument.",
    );
  }
  const bundle = readFileSync(0, "utf8");
  const evaluateBundle = compileFunction(bundle, ["__desktopExternalModules"], {
    filename: `${configPath}.compiled.cjs`,
  });
  const config = assertDesktopConfig(
    evaluateBundle({
      "@croco/problems-core": toCommonJsNamespace(problemsCore),
      "@croco/protocols-desktop": toCommonJsNamespace(protocolsDesktop),
      zod: toCommonJsNamespace(zod),
      "zod/v4/core": toCommonJsNamespace(zodV4Core),
    }),
  );
  const problemRegistries = config.problemRegistries;
  const graph = protocolsDesktop.compileDesktopContractGraph(config.app, {
    ...(problemRegistries ? { problemRegistries } : {}),
    sourceRoot: process.cwd(),
  });
  writeProtocol({
    version: PROTOCOL_VERSION,
    ok: true,
    graph,
    semanticHash: graph.semanticHash,
  });
} catch (error) {
  writeProtocol({
    version: PROTOCOL_VERSION,
    ok: false,
    code: "CROCO_DESKTOP_CONFIG_INVALID",
    message: error instanceof Error ? error.message : String(error),
    recovery:
      "Export default { version: 'croco.desktop-config.v1', app, problemRegistries? } from the desktop config.",
  });
  process.exitCode = 1;
}

function assertDesktopConfig(value: unknown): WorkerConfig {
  if (
    !isRecord(value) ||
    Object.keys(value).some((key) => !["version", "app", "problemRegistries"].includes(key)) ||
    value["version"] !== CONFIG_VERSION ||
    !isRecord(value["app"]) ||
    value["app"]["definitionType"] !== "app"
  ) {
    throw new DesktopConfigValidationError(
      "Desktop config default export must be { version: 'croco.desktop-config.v1', app, problemRegistries? }.",
    );
  }
  if (
    value["problemRegistries"] !== undefined &&
    (!Array.isArray(value["problemRegistries"]) ||
      value["problemRegistries"].some((registry) => !isRecord(registry)))
  ) {
    throw new DesktopConfigValidationError(
      "Desktop config problemRegistries must be an array when provided.",
    );
  }
  return value as WorkerConfig;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toCommonJsNamespace(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  const namespace = { ...value };
  Object.defineProperty(namespace, "__esModule", { value: true });
  return namespace;
}

function writeProtocol(value: unknown): void {
  writeFileSync(3, JSON.stringify(value), "utf8");
}
