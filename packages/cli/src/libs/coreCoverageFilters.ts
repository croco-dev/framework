export function parseCoreCoveragePackageFilters(script: string): string[] {
  const markerIndex = script.indexOf("CORE_COVERAGE=true");
  const coverageSegment = markerIndex >= 0 ? script.slice(markerIndex) : script;
  const filters: string[] = [];
  const packageFilter = "((?:@croco\\/)?[\\w-]+)";
  const filterPattern = new RegExp(
    `--filter\\s+(?:"${packageFilter}"|'${packageFilter}'|${packageFilter})`,
    "g",
  );
  let match: RegExpExecArray | null;

  while ((match = filterPattern.exec(coverageSegment)) !== null) {
    const packageName = match[1] ?? match[2] ?? match[3];
    if (packageName) {
      filters.push(packageName);
    }
  }

  return uniqueStrings(filters);
}

function uniqueStrings(values: readonly string[]): string[] {
  return values.filter((value, index) => values.indexOf(value) === index);
}
