export type MeteringRedisKeyNamespace = "idem2" | "usage2";

export function encodeRedisKeySegment(value: string): string {
  let encoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const character = value.charAt(index);

    encoded += /^[A-Za-z0-9._~-]$/.test(character)
      ? character
      : `%${value.charCodeAt(index).toString(16).toUpperCase().padStart(4, "0")}`;
  }

  return encoded;
}

export function buildMeteringRedisKey(
  namespace: MeteringRedisKeyNamespace,
  segments: readonly string[],
): string {
  return `${namespace}:${segments.map(encodeRedisKeySegment).join(":")}`;
}
