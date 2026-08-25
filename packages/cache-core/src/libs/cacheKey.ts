import { CacheKeyArgumentProblem } from "./problems/CacheDecoratorProblems";

const MAX_CACHE_KEY_GRAPH_DEPTH = 100;
const MAX_CACHE_KEY_GRAPH_NODES = 10_000;

type EncodedCacheKeyValue =
  | readonly ["array", readonly EncodedCacheKeyValue[]]
  | readonly ["boolean", boolean]
  | readonly ["hole"]
  | readonly ["null"]
  | readonly ["number", number | "Infinity" | "-Infinity" | "NaN" | "-0"]
  | readonly ["object", readonly (readonly [string, EncodedCacheKeyValue])[]]
  | readonly ["string", string]
  | readonly ["undefined"];

type CacheKeyEncodingState = {
  readonly ancestors: Set<object>;
  nodeCount: number;
};

export function createCacheKey(prefix: string, args: readonly unknown[]): string {
  const state: CacheKeyEncodingState = { ancestors: new Set<object>(), nodeCount: 0 };
  const encoded = args.map((value, index) =>
    encodeCacheKeyValue(value, `arguments[${index}]`, state, 0),
  );

  return `${prefix}:${JSON.stringify(encoded)}`;
}

function encodeCacheKeyValue(
  value: unknown,
  path: string,
  state: CacheKeyEncodingState,
  depth: number,
): EncodedCacheKeyValue {
  if (depth > MAX_CACHE_KEY_GRAPH_DEPTH) {
    throw new CacheKeyArgumentProblem(
      path,
      `exceeds the maximum supported depth of ${MAX_CACHE_KEY_GRAPH_DEPTH}`,
    );
  }

  claimCacheKeyNode(state, path);

  if (value === undefined) {
    return ["undefined"];
  }

  if (value === null) {
    return ["null"];
  }

  if (typeof value === "string") {
    return ["string", value];
  }

  if (typeof value === "boolean") {
    return ["boolean", value];
  }

  if (typeof value === "number") {
    return ["number", encodeNumber(value)];
  }

  if (typeof value !== "object") {
    throw new CacheKeyArgumentProblem(path, `has unsupported type '${typeof value}'`);
  }

  if (state.ancestors.has(value)) {
    throw new CacheKeyArgumentProblem(path, "contains a cyclic reference");
  }

  state.ancestors.add(value);

  try {
    return Array.isArray(value)
      ? encodeArray(value, path, state, depth)
      : encodeObject(value, path, state, depth);
  } finally {
    state.ancestors.delete(value);
  }
}

function claimCacheKeyNode(state: CacheKeyEncodingState, path: string): void {
  state.nodeCount++;

  if (state.nodeCount > MAX_CACHE_KEY_GRAPH_NODES) {
    throw new CacheKeyArgumentProblem(
      path,
      `exceeds the maximum supported size of ${MAX_CACHE_KEY_GRAPH_NODES} values`,
    );
  }
}

function assertCacheKeyNodeCapacity(
  state: CacheKeyEncodingState,
  additionalNodes: number,
  path: string,
): void {
  if (additionalNodes > MAX_CACHE_KEY_GRAPH_NODES - state.nodeCount) {
    throw new CacheKeyArgumentProblem(
      path,
      `exceeds the maximum supported size of ${MAX_CACHE_KEY_GRAPH_NODES} values`,
    );
  }
}

function encodeNumber(value: number): number | "Infinity" | "-Infinity" | "NaN" | "-0" {
  if (Number.isNaN(value)) {
    return "NaN";
  }

  if (value === Number.POSITIVE_INFINITY) {
    return "Infinity";
  }

  if (value === Number.NEGATIVE_INFINITY) {
    return "-Infinity";
  }

  if (Object.is(value, -0)) {
    return "-0";
  }

  return value;
}

function encodeArray(
  value: readonly unknown[],
  path: string,
  state: CacheKeyEncodingState,
  depth: number,
): EncodedCacheKeyValue {
  assertArrayPropertiesSupported(value, path);
  assertCacheKeyNodeCapacity(state, value.length, path);

  const items: EncodedCacheKeyValue[] = [];

  for (let index = 0; index < value.length; index++) {
    const itemPath = `${path}[${index}]`;
    const descriptor = Object.getOwnPropertyDescriptor(value, index);

    if (descriptor === undefined) {
      claimCacheKeyNode(state, itemPath);
      items.push(["hole"]);
      continue;
    }

    if (!descriptor.enumerable || !("value" in descriptor)) {
      throw new CacheKeyArgumentProblem(itemPath, "is not an enumerable data property");
    }

    items.push(encodeCacheKeyValue(descriptor.value, itemPath, state, depth + 1));
  }

  return ["array", items];
}

function assertArrayPropertiesSupported(value: readonly unknown[], path: string): void {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || (key !== "length" && !isArrayIndex(key, value.length))) {
      throw new CacheKeyArgumentProblem(path, "contains unsupported array properties");
    }
  }
}

function isArrayIndex(key: string, length: number): boolean {
  const index = Number(key);
  return Number.isInteger(index) && index >= 0 && index < length && String(index) === key;
}

function encodeObject(
  value: object,
  path: string,
  state: CacheKeyEncodingState,
  depth: number,
): EncodedCacheKeyValue {
  const prototype = Object.getPrototypeOf(value);

  if (prototype !== Object.prototype && prototype !== null) {
    throw new CacheKeyArgumentProblem(path, "is not a plain object");
  }

  const keys = Reflect.ownKeys(value);
  assertCacheKeyNodeCapacity(state, keys.length, path);

  const entries = keys
    .map((key): readonly [string, EncodedCacheKeyValue] => {
      if (typeof key !== "string") {
        throw new CacheKeyArgumentProblem(path, "contains a symbol property");
      }

      const descriptor = Object.getOwnPropertyDescriptor(value, key);

      if (descriptor === undefined || !descriptor.enumerable || !("value" in descriptor)) {
        throw new CacheKeyArgumentProblem(
          `${path}[${JSON.stringify(key)}]`,
          "is not an enumerable data property",
        );
      }

      return [
        key,
        encodeCacheKeyValue(descriptor.value, `${path}[${JSON.stringify(key)}]`, state, depth + 1),
      ];
    })
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));

  return ["object", entries];
}
