import { compileDesktopWireSchema, DesktopWireSchemaProblem } from "./DesktopWireSchema";
import type {
  DesktopWireSchemaDescriptor,
  DesktopWireSchemaDiagnostic,
  DesktopWireSchemaDiagnosticCode,
  DesktopWireSourceLocation,
} from "./DesktopWireSchema";
import type {
  AnyDesktopGrant,
  BoundDesktopContract,
  DesktopAppDefinition,
  DesktopContractRecord,
  DesktopWindowRecord,
} from "./types";

export type DesktopContractGraphVersion = "croco.desktop-contract-graph.v1";

export type DesktopContractGraphSourceLocations = Readonly<
  Record<string, DesktopWireSourceLocation>
>;

export type CompileDesktopContractGraphOptions = {
  /**
   * Optional source evidence keyed by graph ID. Schema locations use the
   * `<command-id>.input`, `<command-id>.output`, and `<event-id>.payload` IDs.
   */
  readonly sourceLocations?: DesktopContractGraphSourceLocations;
  /** Root removed from source evidence before platform separators are canonicalized. */
  readonly sourceRoot?: string;
};

export type DesktopContractGraphDiagnostic = Omit<DesktopWireSchemaDiagnostic, "code"> & {
  readonly code: DesktopWireSchemaDiagnosticCode | "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE";
  readonly severity: "error";
};

export type DesktopContractGraphSchema =
  | DesktopWireSchemaDescriptor
  | { readonly kind: "grant-reference"; readonly grantId: string };

export type DesktopContractGraphSchemaReference = {
  readonly id: string;
  readonly descriptor: DesktopContractGraphSchema | null;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphCommand = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly kind: "query" | "mutation";
  readonly input: DesktopContractGraphSchemaReference;
  readonly output: DesktopContractGraphSchemaReference;
  readonly effects: readonly string[];
  readonly problems: readonly string[];
  readonly events: readonly string[];
  readonly executionPolicy: {
    readonly mode: "request-response";
  };
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphEvent = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly payload: DesktopContractGraphSchemaReference;
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphGrant = {
  readonly id: string;
  readonly contractId: string;
  readonly key: string;
  readonly resource: "file" | "directory";
  readonly access: "read" | "write";
  readonly scope: "exact" | "descendant";
  readonly lifetime: "command" | "window" | "session";
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphContract = {
  readonly id: string;
  readonly commandIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly grantIds: readonly string[];
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphWindow = {
  readonly id: string;
  readonly trust: "local" | "remote";
  readonly originPolicy:
    | { readonly mode: "local-content" }
    | {
        readonly mode: "remote-allowlist";
        readonly initialUrl: string;
        readonly allowedOrigins: readonly string[];
      };
  readonly exposedCommands: readonly string[];
  readonly receivedEvents: readonly string[];
  readonly sourceLocation?: DesktopWireSourceLocation;
};

export type DesktopContractGraphV1 = {
  readonly version: DesktopContractGraphVersion;
  readonly semanticHash: `sha256:${string}`;
  readonly app: {
    readonly contractIds: readonly string[];
    readonly windowIds: readonly string[];
    readonly sourceLocation?: DesktopWireSourceLocation;
  };
  readonly contracts: readonly DesktopContractGraphContract[];
  readonly commands: readonly DesktopContractGraphCommand[];
  readonly events: readonly DesktopContractGraphEvent[];
  readonly effects: readonly string[];
  readonly grants: readonly DesktopContractGraphGrant[];
  readonly problems: readonly string[];
  readonly windows: readonly DesktopContractGraphWindow[];
  readonly diagnostics: readonly DesktopContractGraphDiagnostic[];
};

type MutableGraphParts = {
  readonly contracts: DesktopContractGraphContract[];
  readonly commands: DesktopContractGraphCommand[];
  readonly events: DesktopContractGraphEvent[];
  readonly grants: DesktopContractGraphGrant[];
  readonly diagnostics: DesktopContractGraphDiagnostic[];
};

export function compileDesktopContractGraph(
  app: DesktopAppDefinition<DesktopContractRecord, DesktopWindowRecord>,
  options: CompileDesktopContractGraphOptions = {},
): DesktopContractGraphV1 {
  const sourceLocations = normalizeSourceLocations(
    options.sourceLocations ?? {},
    options.sourceRoot,
  );
  const parts: MutableGraphParts = {
    contracts: [],
    commands: [],
    events: [],
    grants: [],
    diagnostics: [],
  };

  for (const [contractId, contract] of sortedEntries(app.contracts)) {
    compileContract(contractId, contract, sourceLocations, parts);
  }
  parts.commands.sort(compareById);
  parts.events.sort(compareById);
  parts.grants.sort(compareById);

  const windows = sortedEntries(app.windows).map(([windowId, window]) => {
    const sourceLocation = sourceLocations[`window:${windowId}`];
    if (window.trust === "remote") {
      return {
        id: windowId,
        trust: "remote" as const,
        originPolicy: {
          mode: "remote-allowlist" as const,
          initialUrl: window.initialUrl,
          allowedOrigins: [...window.allowedOrigins].sort(compareCodeUnits),
        },
        exposedCommands: [],
        receivedEvents: [],
        ...(sourceLocation ? { sourceLocation } : {}),
      };
    }

    return {
      id: windowId,
      trust: "local" as const,
      originPolicy: { mode: "local-content" as const },
      exposedCommands: window.expose.map((command) => command.id).sort(compareCodeUnits),
      receivedEvents: window.receive.map((event) => event.id).sort(compareCodeUnits),
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  });
  const appSourceLocation = sourceLocations.app;
  const semanticGraph = {
    version: "croco.desktop-contract-graph.v1" as const,
    app: {
      contractIds: parts.contracts.map((contract) => contract.id),
      windowIds: windows.map((window) => window.id),
    },
    contracts: stripSourceLocations(parts.contracts),
    commands: stripSourceLocations(parts.commands),
    events: stripSourceLocations(parts.events),
    effects: [] as readonly never[],
    grants: stripSourceLocations(parts.grants),
    problems: [] as readonly never[],
    windows: stripSourceLocations(windows),
    diagnostics: parts.diagnostics
      .map(({ code, severity, contractMember, schemaPath }) => ({
        code,
        severity,
        contractMember,
        schemaPath,
      }))
      .sort(compareDiagnostics),
  };

  return {
    version: semanticGraph.version,
    semanticHash: `sha256:${sha256(stableStringify(semanticGraph))}`,
    app: {
      ...semanticGraph.app,
      ...(appSourceLocation ? { sourceLocation: appSourceLocation } : {}),
    },
    contracts: parts.contracts,
    commands: parts.commands,
    events: parts.events,
    effects: [],
    grants: parts.grants,
    problems: [],
    windows,
    diagnostics: parts.diagnostics.sort(compareDiagnostics),
  };
}

export function stringifyDesktopContractGraph(graph: DesktopContractGraphV1): string {
  return `${stableStringify(graph, 2)}\n`;
}

function compileContract(
  contractId: string,
  contract: BoundDesktopContract<DesktopContractRecord[string], string>,
  sourceLocations: DesktopContractGraphSourceLocations,
  parts: MutableGraphParts,
): void {
  const commands = sortedEntries(contract.commands);
  const events = sortedEntries(contract.events);
  const grants = sortedEntries(contract.grants);
  const grantIds = new Map<object, string[]>();
  for (const [, grant] of grants) {
    const ids = grantIds.get(grant["~standard"]) ?? [];
    ids.push(grant.id);
    grantIds.set(grant["~standard"], ids);
  }

  for (const [, command] of commands) {
    const sourceLocation = sourceLocations[command.id];
    parts.commands.push({
      id: command.id,
      contractId,
      key: command.memberKey,
      kind: command.kind,
      input: compileSchemaReference(
        `${command.id}.input`,
        command.input,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      output: compileSchemaReference(
        `${command.id}.output`,
        command.output,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      effects: [],
      problems: [],
      events: [],
      executionPolicy: { mode: "request-response" },
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  for (const [, event] of events) {
    const sourceLocation = sourceLocations[event.id];
    parts.events.push({
      id: event.id,
      contractId,
      key: event.memberKey,
      payload: compileSchemaReference(
        `${event.id}.payload`,
        event.payload,
        sourceLocations,
        grantIds,
        parts.diagnostics,
      ),
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  for (const [, grant] of grants) {
    const sourceLocation = sourceLocations[grant.id];
    parts.grants.push({
      id: grant.id,
      contractId,
      key: grant.memberKey,
      resource: grant.resource,
      access: grant.access,
      scope: grant.scope,
      lifetime: grant.lifetime,
      ...(sourceLocation ? { sourceLocation } : {}),
    });
  }

  const sourceLocation = sourceLocations[`contract:${contractId}`];
  parts.contracts.push({
    id: contractId,
    commandIds: commands.map(([, command]) => command.id),
    eventIds: events.map(([, event]) => event.id),
    grantIds: grants.map(([, grant]) => grant.id),
    ...(sourceLocation ? { sourceLocation } : {}),
  });
}

function compileSchemaReference(
  id: string,
  schema: unknown,
  sourceLocations: DesktopContractGraphSourceLocations,
  grantIds: ReadonlyMap<object, readonly string[]>,
  diagnostics: DesktopContractGraphDiagnostic[],
): DesktopContractGraphSchemaReference {
  const sourceLocation = sourceLocations[id];
  const matchingGrantIds = isDesktopGrant(schema) ? grantIds.get(schema["~standard"]) : undefined;
  const grantId = matchingGrantIds?.length === 1 ? matchingGrantIds[0] : undefined;
  if (grantId) {
    return {
      id,
      descriptor: { kind: "grant-reference", grantId },
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  }
  if (matchingGrantIds && matchingGrantIds.length > 1) {
    diagnostics.push({
      severity: "error",
      code: "DESKTOP_GRAPH_AMBIGUOUS_GRANT_REFERENCE",
      contractMember: id,
      schemaPath: [],
      message: `Desktop grant reference matches multiple mounted grant IDs: ${matchingGrantIds.join(", ")}.`,
      recovery:
        "Declare each grant once or use distinct grant definitions for distinct authority identities.",
      ...(sourceLocation ? { sourceLocation } : {}),
    });
    return { id, descriptor: null, ...(sourceLocation ? { sourceLocation } : {}) };
  }

  try {
    return {
      id,
      descriptor: compileDesktopWireSchema(schema, {
        contractMember: id,
        ...(sourceLocation ? { sourceLocation } : {}),
      }),
      ...(sourceLocation ? { sourceLocation } : {}),
    };
  } catch (error) {
    if (!(error instanceof DesktopWireSchemaProblem)) throw error;
    diagnostics.push(
      ...error.diagnostics.map((diagnostic) => ({ ...diagnostic, severity: "error" as const })),
    );
    return { id, descriptor: null, ...(sourceLocation ? { sourceLocation } : {}) };
  }
}

function normalizeSourceLocations(
  sourceLocations: DesktopContractGraphSourceLocations,
  sourceRoot: string | undefined,
): DesktopContractGraphSourceLocations {
  return Object.fromEntries(
    sortedEntries(sourceLocations).map(([id, sourceLocation]) => [
      id,
      normalizeSourceLocation(sourceLocation, sourceRoot),
    ]),
  );
}

function normalizeSourceLocation(
  source: DesktopWireSourceLocation,
  sourceRoot: string | undefined,
): DesktopWireSourceLocation {
  const normalizedPath = source.path.replace(/\\/g, "/");
  const normalizedRoot = sourceRoot?.replace(/\\/g, "/").replace(/\/+$/, "");
  const path =
    normalizedRoot && normalizedPath.startsWith(`${normalizedRoot}/`)
      ? normalizedPath.slice(normalizedRoot.length + 1)
      : normalizedPath;

  return {
    path,
    ...(source.line === undefined ? {} : { line: source.line }),
    ...(source.column === undefined ? {} : { column: source.column }),
  };
}

function stripSourceLocations<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripSourceLocations(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => key !== "sourceLocation")
        .map(([key, item]) => [key, stripSourceLocations(item)]),
    ) as T;
  }
  return value;
}

function sortedEntries<T>(record: Readonly<Record<string, T>>): readonly (readonly [string, T])[] {
  return Object.entries(record).sort(([left], [right]) => compareCodeUnits(left, right));
}

function isDesktopGrant(value: unknown): value is AnyDesktopGrant {
  return (
    typeof value === "object" &&
    value !== null &&
    "definitionType" in value &&
    value.definitionType === "grant"
  );
}

function compareDiagnostics(
  left: Pick<DesktopContractGraphDiagnostic, "code" | "contractMember" | "schemaPath">,
  right: Pick<DesktopContractGraphDiagnostic, "code" | "contractMember" | "schemaPath">,
): number {
  return (
    compareCodeUnits(left.contractMember, right.contractMember) ||
    compareCodeUnits(left.schemaPath.join("."), right.schemaPath.join(".")) ||
    compareCodeUnits(left.code, right.code)
  );
}

function compareById(left: { readonly id: string }, right: { readonly id: string }): number {
  return compareCodeUnits(left.id, right.id);
}

function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableStringify(value: unknown, space = 0, depth = 0): string {
  const indent = space > 0 ? " ".repeat(space * depth) : "";
  const nextIndent = space > 0 ? " ".repeat(space * (depth + 1)) : "";
  const separator = space > 0 ? ": " : ":";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const values = value.map((item) => `${nextIndent}${stableStringify(item, space, depth + 1)}`);
    return space > 0 ? `[\n${values.join(",\n")}\n${indent}]` : `[${values.join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareCodeUnits)
      .map(
        (key) =>
          `${nextIndent}${JSON.stringify(key)}${separator}${stableStringify(record[key], space, depth + 1)}`,
      );
    if (entries.length === 0) return "{}";
    return space > 0 ? `{\n${entries.join(",\n")}\n${indent}}` : `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string): string {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ];
  const bytes = utf8Bytes(value);
  const bitLength = bytes.length * 8;
  bytes.push(0x80);
  while (bytes.length % 64 !== 56) bytes.push(0);
  for (let shift = 56; shift >= 0; shift -= 8) {
    bytes.push(Math.floor(bitLength / 2 ** shift) & 0xff);
  }

  for (let offset = 0; offset < bytes.length; offset += 64) {
    const words = Array.from<number>({ length: 64 }).fill(0);
    for (let index = 0; index < 16; index++) {
      const byteOffset = offset + index * 4;
      words[index] =
        ((bytes[byteOffset] ?? 0) << 24) |
        ((bytes[byteOffset + 1] ?? 0) << 16) |
        ((bytes[byteOffset + 2] ?? 0) << 8) |
        (bytes[byteOffset + 3] ?? 0);
    }
    for (let index = 16; index < 64; index++) {
      const word15 = words[index - 15] ?? 0;
      const word2 = words[index - 2] ?? 0;
      const sigma0 = rotateRight(word15, 7) ^ rotateRight(word15, 18) ^ (word15 >>> 3);
      const sigma1 = rotateRight(word2, 17) ^ rotateRight(word2, 19) ^ (word2 >>> 10);
      words[index] = ((words[index - 16] ?? 0) + sigma0 + (words[index - 7] ?? 0) + sigma1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
      const bigSigma1 = rotateRight(e ?? 0, 6) ^ rotateRight(e ?? 0, 11) ^ rotateRight(e ?? 0, 25);
      const choose = ((e ?? 0) & (f ?? 0)) ^ (~(e ?? 0) & (g ?? 0));
      const temporary1 =
        ((h ?? 0) + bigSigma1 + choose + (constants[index] ?? 0) + (words[index] ?? 0)) >>> 0;
      const bigSigma0 = rotateRight(a ?? 0, 2) ^ rotateRight(a ?? 0, 13) ^ rotateRight(a ?? 0, 22);
      const majority = ((a ?? 0) & (b ?? 0)) ^ ((a ?? 0) & (c ?? 0)) ^ ((b ?? 0) & (c ?? 0));
      const temporary2 = (bigSigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = ((d ?? 0) + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = ((hash[0] ?? 0) + (a ?? 0)) >>> 0;
    hash[1] = ((hash[1] ?? 0) + (b ?? 0)) >>> 0;
    hash[2] = ((hash[2] ?? 0) + (c ?? 0)) >>> 0;
    hash[3] = ((hash[3] ?? 0) + (d ?? 0)) >>> 0;
    hash[4] = ((hash[4] ?? 0) + (e ?? 0)) >>> 0;
    hash[5] = ((hash[5] ?? 0) + (f ?? 0)) >>> 0;
    hash[6] = ((hash[6] ?? 0) + (g ?? 0)) >>> 0;
    hash[7] = ((hash[7] ?? 0) + (h ?? 0)) >>> 0;
  }

  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function utf8Bytes(value: string): number[] {
  const bytes: number[] = [];
  for (let index = 0; index < value.length; index++) {
    const first = value.charCodeAt(index);
    const second = value.charCodeAt(index + 1);
    const codePoint =
      first >= 0xd800 && first <= 0xdbff && second >= 0xdc00 && second <= 0xdfff
        ? ((first - 0xd800) << 10) + (second - 0xdc00) + 0x10000
        : first;
    if (codePoint > 0xffff) index++;
    if (codePoint < 0x80) bytes.push(codePoint);
    else if (codePoint < 0x800) bytes.push(0xc0 | (codePoint >>> 6), 0x80 | (codePoint & 0x3f));
    else if (codePoint < 0x10000) {
      bytes.push(
        0xe0 | (codePoint >>> 12),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >>> 18),
        0x80 | ((codePoint >>> 12) & 0x3f),
        0x80 | ((codePoint >>> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      );
    }
  }
  return bytes;
}

function rotateRight(value: number, bits: number): number {
  return (value >>> bits) | (value << (32 - bits));
}
