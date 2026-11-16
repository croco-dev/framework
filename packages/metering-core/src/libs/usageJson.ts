import { RedisProblem } from "./problems/RedisProblem";

export const MAX_USAGE_JSON_DEPTH = 1_000;

export function stableStringify(value: unknown): string {
  return JSON.stringify(value, (_key, nestedValue: unknown) => {
    if (nestedValue === null || typeof nestedValue !== "object" || Array.isArray(nestedValue)) {
      return nestedValue;
    }

    const prototype = Object.getPrototypeOf(nestedValue);
    if (prototype !== Object.prototype && prototype !== null) {
      return nestedValue;
    }

    return Object.fromEntries(
      Object.entries(nestedValue as Record<string, unknown>).sort(([left], [right]) =>
        left < right ? -1 : left > right ? 1 : 0,
      ),
    );
  });
}

export function parseUsageJson(json: string, operation: "SERIALIZE" | "ZRANGEBYSCORE"): unknown {
  // Validate original tokens: JSON.parse discards overwritten duplicate properties before a reviver runs.
  let depth = 0;
  for (let index = 0; index < json.length; index += 1) {
    const character = json[index];
    if (character === '"') {
      const start = index;
      index += 1;
      while (index < json.length) {
        if (json[index] === "\\") {
          index += 2;
        } else if (json[index] === '"') {
          break;
        } else {
          index += 1;
        }
      }
      const token: unknown = JSON.parse(json.slice(start, index + 1));
      if (typeof token === "string") {
        encodeURIComponent(token);
      }
    } else if (character === "{" || character === "[") {
      depth += 1;
      if (depth > MAX_USAGE_JSON_DEPTH) {
        throw new RedisProblem(
          operation,
          `Usage JSON exceeds the maximum depth of ${MAX_USAGE_JSON_DEPTH}`,
        );
      }
    } else if (character === "}" || character === "]") {
      depth -= 1;
    }
  }
  return JSON.parse(json);
}
