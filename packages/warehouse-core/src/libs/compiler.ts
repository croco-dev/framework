import { canonicalJson } from "./primitives";
import { assertContract, WarehouseContractError } from "./diagnostics";
import { assertFact } from "./schema";
import type {
  Columns,
  ColumnKeyOfType,
  FactDeclaration,
  FactDescriptor,
  FactOptions,
} from "./types";

type CurrencyReferences<C extends Columns> = {
  readonly [K in keyof C]: C[K] extends { readonly type: "money" }
    ? C[K] & { readonly currency: ColumnKeyOfType<C, "currency"> }
    : C[K];
};

function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

export function defineFact<const C extends Columns>(
  name: string,
  options: FactOptions<C> & { readonly columns: C & CurrencyReferences<C> },
): FactDeclaration<C> {
  assertContract(
    !["name", "irVersion", "compilerVersion", "semanticHash"].some((key) =>
      Object.hasOwn(options, key),
    ),
    "WAREHOUSE_INVALID_DECLARATION",
  );
  const fact = { ...options, name };
  assertFact(fact);
  return freeze(JSON.parse(canonicalJson(fact)) as FactDeclaration<C>);
}

function semanticValue(value: Omit<FactDescriptor, "semanticHash">): unknown {
  const { description: _description, sourceRefs: _sources, ...semantic } = value;
  const { description: _grainDescription, ...grain } = value.grain;
  const columns = Object.fromEntries(
    Object.entries(value.columns).map(([key, column]) => {
      const { description: _columnDescription, ...meaning } = column;
      return [key, meaning];
    }),
  );
  return { ...semantic, grain, columns };
}

export async function compileFact(declaration: FactDeclaration): Promise<FactDescriptor> {
  assertFact(declaration);
  const {
    irVersion: _ir,
    compilerVersion: _compiler,
    semanticHash: _hash,
    ...fact
  } = declaration as FactDescriptor;
  const ir = JSON.parse(canonicalJson({ ...fact, irVersion: 1, compilerVersion: "1" })) as Omit<
    FactDescriptor,
    "semanticHash"
  >;
  assertContract(globalThis.crypto?.subtle, "WAREHOUSE_CRYPTO_UNAVAILABLE");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(semanticValue(ir))),
  );
  const semanticHash = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return freeze({ ...ir, semanticHash } as FactDescriptor);
}

export function serializeDescriptor(descriptor: FactDescriptor): string {
  assertFact(descriptor);
  assertContract(
    descriptor.irVersion === 1 &&
      descriptor.compilerVersion === "1" &&
      /^[a-f0-9]{64}$/.test(descriptor.semanticHash),
    "WAREHOUSE_INVALID_DESCRIPTOR",
  );
  return canonicalJson(descriptor);
}

export async function parseDescriptor(json: string): Promise<FactDescriptor> {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    throw new WarehouseContractError("WAREHOUSE_INVALID_JSON");
  }
  assertFact(value);
  const candidate = value as FactDescriptor;
  assertContract(
    candidate.irVersion === 1 &&
      candidate.compilerVersion === "1" &&
      typeof candidate.semanticHash === "string" &&
      /^[a-f0-9]{64}$/.test(candidate.semanticHash),
    "WAREHOUSE_INVALID_DESCRIPTOR",
  );
  const compiled = await compileFact(value);
  assertContract(
    compiled.semanticHash === candidate.semanticHash,
    "WAREHOUSE_SEMANTIC_HASH_MISMATCH",
  );
  return compiled;
}
