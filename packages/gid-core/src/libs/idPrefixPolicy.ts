export const MINIMUM_ID_PREFIX_LENGTH = 3;
export const MAXIMUM_ID_PREFIX_LENGTH = 32;
export const ID_PREFIX_GRAMMAR = "^[a-z0-9]{3,32}$";

const ID_PREFIX_PATTERN = new RegExp(ID_PREFIX_GRAMMAR);

export type InvalidIdPrefixReason = "too-short" | "too-long" | "invalid-characters";

export function getInvalidIdPrefixReason(prefix: string): InvalidIdPrefixReason | undefined {
  if (prefix.length < MINIMUM_ID_PREFIX_LENGTH) {
    return "too-short";
  }

  if (prefix.length > MAXIMUM_ID_PREFIX_LENGTH) {
    return "too-long";
  }

  if (!ID_PREFIX_PATTERN.test(prefix)) {
    return "invalid-characters";
  }

  return undefined;
}
