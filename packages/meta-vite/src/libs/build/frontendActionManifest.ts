import {
  checkFrontendActionManifestFile,
  createFrontendActionManifest,
  serializeFrontendActionManifest,
  writeFrontendActionManifest,
  type FrontendActionManifest,
  type FrontendActionManifestEntry,
  type FrontendActionProblem,
  type FrontendActionShapeReference,
} from "@croco/presentation-preset";
import type { ServerActionContractIR } from "../actions/serverActions";

export type MetaViteFrontendActionManifestSource = {
  readonly serverActions?: readonly ServerActionContractIR[];
};

export type MetaViteServerActionRegistryFrontendActionManifestSource = {
  readonly getActions: () => readonly ServerActionContractIR[];
};

export type MetaViteFrontendActionManifestRegistryOptions = {
  readonly serverActionRegistry: MetaViteServerActionRegistryFrontendActionManifestSource;
};

export function createMetaViteFrontendActionManifest(
  source: MetaViteFrontendActionManifestSource,
): FrontendActionManifest {
  return createFrontendActionManifest(
    [...(source.serverActions ?? [])]
      .sort((left, right) => compareStrings(left.name, right.name))
      .map(createFrontendActionEntry),
  );
}

export function createMetaViteFrontendActionManifestFromRegistry(
  options: MetaViteFrontendActionManifestRegistryOptions,
): FrontendActionManifest {
  return createMetaViteFrontendActionManifest({
    serverActions: options.serverActionRegistry.getActions(),
  });
}

export const serializeMetaViteFrontendActionManifest = serializeFrontendActionManifest;

export const writeMetaViteFrontendActionManifest = writeFrontendActionManifest;

export const checkMetaViteFrontendActionManifestFile = checkFrontendActionManifestFile;

function createFrontendActionEntry(action: ServerActionContractIR): FrontendActionManifestEntry {
  return {
    id: `server-action:${action.name}`,
    source: {
      kind: "meta-vite-server-action",
      packageName: "@croco/meta-vite",
      actionName: action.name,
    },
    method: action.method,
    path: action.path,
    input: createInputReference(action),
    output: createOutputReference(action),
    problems: createProblemMetadata(action),
    permissions: {
      guards: [],
      roles: [],
      entitlements: [],
    },
    invalidates: action.invalidates ?? [],
  };
}

function createInputReference(action: ServerActionContractIR): FrontendActionShapeReference {
  if (action.input.schema === "none") {
    return { kind: "none" };
  }

  return {
    kind: "declared-schema",
    ref: `${action.name}.input`,
    locations: ["form-data"],
  };
}

function createOutputReference(action: ServerActionContractIR): FrontendActionShapeReference {
  if (action.output.schema === "none") {
    return {
      kind: "none",
      ...(action.output.description ? { description: action.output.description } : {}),
    };
  }

  return {
    kind: "declared-schema",
    ref: `${action.name}.output`,
    ...(action.output.description ? { description: action.output.description } : {}),
  };
}

function createProblemMetadata(action: ServerActionContractIR): readonly FrontendActionProblem[] {
  return [...action.problems]
    .sort(
      (left, right) =>
        compareStrings(left.code, right.code) ||
        (left.status ?? 0) - (right.status ?? 0) ||
        compareStrings(left.description ?? "", right.description ?? ""),
    )
    .map((problem) => ({
      code: problem.code,
      ...(problem.status !== undefined ? { status: problem.status } : {}),
      ...(problem.description ? { description: problem.description } : {}),
      ...(problem.type ? { type: problem.type } : {}),
    }));
}

function compareStrings(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}
