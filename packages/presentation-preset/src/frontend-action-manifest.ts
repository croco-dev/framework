export const FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION = "croco.frontend-action-manifest.v1" as const;

export type FrontendActionManifestSourceKind = "rest-rpc-route" | "meta-vite-server-action";

export type FrontendActionShapeReferenceKind = "generated-type" | "declared-schema" | "none";

export type FrontendActionInputLocation = "body" | "path" | "query" | "headers" | "form-data";

export type FrontendActionShapeReference = {
  readonly kind: FrontendActionShapeReferenceKind;
  readonly ref?: string;
  readonly locations?: readonly FrontendActionInputLocation[];
  readonly description?: string;
};

export type FrontendActionSource = {
  readonly kind: FrontendActionManifestSourceKind;
  readonly packageName: string;
  readonly routeId?: string;
  readonly operationId?: string;
  readonly controllerName?: string;
  readonly methodName?: string;
  readonly domain?: string;
  readonly actionName?: string;
};

export type FrontendActionProblem = {
  readonly code: string;
  readonly category?: string;
  readonly status?: number;
  readonly description?: string;
  readonly type?: string;
  readonly cookbookPath?: string;
};

export type FrontendActionMetadataReference = {
  readonly id: string;
  readonly name: string;
  readonly owner?: {
    readonly controllerName: string;
    readonly routeId?: string;
    readonly methodName?: string;
  };
};

export type FrontendActionEntitlementResource = {
  readonly type: string;
  readonly id?: string;
  readonly idParam?: string;
};

export type FrontendActionEntitlement = {
  readonly feature: string;
  readonly description?: string;
  readonly resource?: FrontendActionEntitlementResource;
};

export type FrontendActionPermissionMetadata = {
  readonly guards: readonly FrontendActionMetadataReference[];
  readonly roles: readonly string[];
  readonly entitlements: readonly FrontendActionEntitlement[];
};

export type FrontendActionInvalidationHint = {
  readonly kind: "query-key-prefix" | "custom";
  readonly target: string;
  readonly reason?: string;
};

export type FrontendActionManifestEntry = {
  readonly id: string;
  readonly source: FrontendActionSource;
  readonly method: string;
  readonly path: string;
  readonly input: FrontendActionShapeReference;
  readonly output: FrontendActionShapeReference;
  readonly problems: readonly FrontendActionProblem[];
  readonly permissions: FrontendActionPermissionMetadata;
  readonly invalidates: readonly FrontendActionInvalidationHint[];
};

export type FrontendActionManifest = {
  readonly schemaVersion: typeof FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION;
  readonly actions: readonly FrontendActionManifestEntry[];
};

export type FrontendActionManifestDrift =
  | {
      readonly ok: true;
      readonly status: "current";
      readonly path: string;
    }
  | {
      readonly ok: false;
      readonly status: "missing" | "different";
      readonly path: string;
      readonly expected: string;
      readonly actual?: string;
    };

export function createFrontendActionManifest(
  actions: readonly FrontendActionManifestEntry[],
): FrontendActionManifest {
  return {
    schemaVersion: FRONTEND_ACTION_MANIFEST_SCHEMA_VERSION,
    actions: sortFrontendActionManifestEntries(actions),
  };
}

export function serializeFrontendActionManifest(manifest: FrontendActionManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export async function writeFrontendActionManifest(
  manifest: FrontendActionManifest,
  outputPath: string,
): Promise<void> {
  const [{ mkdir, writeFile }, { dirname }] = await Promise.all([
    import("node:fs/promises"),
    import("node:path"),
  ]);

  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, serializeFrontendActionManifest(manifest), "utf-8");
}

export async function checkFrontendActionManifestFile(
  manifest: FrontendActionManifest,
  outputPath: string,
): Promise<FrontendActionManifestDrift> {
  const expected = serializeFrontendActionManifest(manifest);
  const { readFile } = await import("node:fs/promises");

  try {
    const actual = await readFile(outputPath, "utf-8");

    if (actual === expected) {
      return { ok: true, status: "current", path: outputPath };
    }

    return { ok: false, status: "different", path: outputPath, expected, actual };
  } catch (error) {
    if (isMissingFileError(error)) {
      return { ok: false, status: "missing", path: outputPath, expected };
    }

    throw error;
  }
}

function sortFrontendActionManifestEntries(
  actions: readonly FrontendActionManifestEntry[],
): readonly FrontendActionManifestEntry[] {
  return [...actions].sort(
    (left, right) =>
      compareStrings(left.id, right.id) ||
      compareStrings(left.source.kind, right.source.kind) ||
      compareStrings(left.method, right.method) ||
      compareStrings(left.path, right.path),
  );
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

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { readonly code?: unknown }).code === "ENOENT"
  );
}
