import semver from "semver";

export function isBoundedPeerDependencyRange(range) {
  if (typeof range !== "string") {
    return false;
  }

  let parsedRange;
  try {
    parsedRange = new semver.Range(range);
  } catch {
    return false;
  }

  if (!parsedRange.range) {
    return false;
  }

  return parsedRange.set.every((comparators) =>
    comparators.some((comparator) => {
      if (comparator.operator === "<" || comparator.operator === "<=") {
        return true;
      }

      return comparator.operator === "" && typeof comparator.semver !== "symbol";
    }),
  );
}
