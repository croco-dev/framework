import type { RouteContractSourceLocation } from "./types/RouteContract";

export function captureRestDecoratorSourceLocation(): RouteContractSourceLocation | undefined {
  return findRestDecoratorSourceLocation(new Error().stack);
}

export function findRestDecoratorSourceLocation(
  stackTrace: string | undefined,
): RouteContractSourceLocation | undefined {
  const stack = stackTrace?.split("\n").slice(2) ?? [];

  for (const line of stack) {
    const sourceLocation = parseStackSourceLocation(line);

    if (!sourceLocation || isInternalRestDecoratorFrame(sourceLocation.path)) {
      continue;
    }

    return sourceLocation;
  }

  return undefined;
}

function parseStackSourceLocation(line: string): RouteContractSourceLocation | undefined {
  const trimmed = line.trim();
  const match =
    trimmed.match(/\(?((?:file:\/\/)?\/.*):(\d+):(\d+)\)?$/) ??
    trimmed.match(/\(?([A-Za-z]:\\.*):(\d+):(\d+)\)?$/);

  if (!match) {
    return undefined;
  }

  return {
    path: match[1].replace(/^file:\/\//, ""),
    line: Number(match[2]),
    column: Number(match[3]),
  };
}

function isInternalRestDecoratorFrame(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");

  return (
    normalizedPath.includes("/node_modules/") ||
    normalizedPath.endsWith("/sourceLocation.ts") ||
    normalizedPath.endsWith("/sourceLocation.js") ||
    normalizedPath.endsWith("/Params.ts") ||
    normalizedPath.endsWith("/Params.js") ||
    normalizedPath.endsWith("/HttpMethod.ts") ||
    normalizedPath.endsWith("/HttpMethod.js") ||
    normalizedPath.endsWith("/ResponseSchema.ts") ||
    normalizedPath.endsWith("/ResponseSchema.js")
  );
}
