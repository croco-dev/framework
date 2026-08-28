export function compareCodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function stringifyCanonicalJson(value: unknown, space = 0, depth = 0): string {
  const indent = space > 0 ? " ".repeat(space * depth) : "";
  const nextIndent = space > 0 ? " ".repeat(space * (depth + 1)) : "";
  const separator = space > 0 ? ": " : ":";
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    const values = value.map(
      (item) => `${nextIndent}${stringifyCanonicalJson(item, space, depth + 1)}`,
    );
    return space > 0 ? `[\n${values.join(",\n")}\n${indent}]` : `[${values.join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort(compareCodeUnits)
      .map(
        (key) =>
          `${nextIndent}${JSON.stringify(key)}${separator}${stringifyCanonicalJson(record[key], space, depth + 1)}`,
      );
    if (entries.length === 0) return "{}";
    return space > 0 ? `{\n${entries.join(",\n")}\n${indent}}` : `{${entries.join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}
