import { MetadataStorage } from "@croco/framework-context";
import { SearchableIndexConflictProblem } from "../problems/SearchProblems";
import { SEARCHABLE_METADATA } from "./constants";

import type {
  SearchableIndexDeclaration,
  SearchableMetadata,
  SearchableSourceLocation,
} from "./SearchableTypes";

export function findSearchableSourceLocation(
  stackTrace: string | undefined,
): SearchableSourceLocation | undefined {
  const stack = stackTrace?.split("\n").slice(2) ?? [];

  for (const line of stack) {
    const sourceLocation = parseStackSourceLocation(line);
    if (!sourceLocation || isInternalSearchableFrame(sourceLocation.path)) {
      continue;
    }

    return sourceLocation;
  }

  return undefined;
}

export function assertSearchableIndexAvailable(metadata: SearchableMetadata): void {
  const declarations = MetadataStorage.getAll<SearchableMetadata>(SEARCHABLE_METADATA)
    .map((entry) => entry.value)
    .filter((registered) => registered.index === metadata.index)
    .map(toSearchableIndexDeclaration);

  if (declarations.length > 0) {
    throw new SearchableIndexConflictProblem(metadata.index, [
      ...declarations,
      toSearchableIndexDeclaration(metadata),
    ]);
  }
}

export function compileSearchableMetadataRegistry(): ReadonlyMap<string, SearchableMetadata> {
  const metadataByIndex = new Map<string, SearchableMetadata[]>();

  for (const { value } of MetadataStorage.getAll<SearchableMetadata>(SEARCHABLE_METADATA)) {
    const declarations = metadataByIndex.get(value.index) ?? [];
    declarations.push(value);
    metadataByIndex.set(value.index, declarations);
  }

  const conflictingIndex = [...metadataByIndex.entries()]
    .filter(([, declarations]) => declarations.length > 1)
    .sort(([left], [right]) => left.localeCompare(right))[0];

  if (conflictingIndex) {
    const [indexName, metadata] = conflictingIndex;
    throw new SearchableIndexConflictProblem(indexName, metadata.map(toSearchableIndexDeclaration));
  }

  return new Map(
    [...metadataByIndex.entries()].map(([indexName, declarations]) => [
      indexName,
      declarations[0] as SearchableMetadata,
    ]),
  );
}

function toSearchableIndexDeclaration(metadata: SearchableMetadata): SearchableIndexDeclaration {
  return {
    targetName: metadata.target.name || "(anonymous)",
    ...(metadata.sourceLocation ? { sourceLocation: metadata.sourceLocation } : {}),
  };
}

function parseStackSourceLocation(line: string): SearchableSourceLocation | undefined {
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

function isInternalSearchableFrame(path: string): boolean {
  const normalizedPath = path.replace(/\\/g, "/");
  return (
    normalizedPath.includes("/node_modules/@croco/search-core/") ||
    normalizedPath.includes("/packages/search-core/dist/") ||
    normalizedPath.endsWith("/SearchableMetadataRegistry.ts") ||
    normalizedPath.endsWith("/SearchableMetadataRegistry.js") ||
    normalizedPath.endsWith("/Searchable.ts") ||
    normalizedPath.endsWith("/Searchable.js")
  );
}
