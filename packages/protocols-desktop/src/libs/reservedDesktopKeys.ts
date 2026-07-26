export const RESERVED_DESKTOP_KEYS = [
  "__proto__",
  "constructor",
  "prototype",
  "contracts",
  "windows",
  "commands",
  "events",
  "metadata",
  "implement",
] as const;

export type ReservedDesktopKey = (typeof RESERVED_DESKTOP_KEYS)[number];
