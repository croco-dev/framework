import { CURSOR_VERSION } from "./constants";
import { InvalidCursorProblem } from "./problems";
import type { CursorPayload } from "./types";

/**
 * Encode a cursor payload to URL-safe Base64 string
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  if (typeof json !== "string") {
    throw new InvalidCursorProblem("Cursor payload is not JSON-serializable");
  }

  const bytes = new TextEncoder().encode(json);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Decode a URL-safe Base64 cursor string to payload
 * @throws InvalidCursorProblem if cursor is invalid
 */
export function decodeCursor(cursor: string): CursorPayload {
  if (!cursor || typeof cursor !== "string") {
    throw new InvalidCursorProblem("Cursor is empty or not a string");
  }

  const base64 = toPaddedBase64(cursor);
  if (base64 === undefined) {
    throw new InvalidCursorProblem("Cursor is not valid Base64");
  }

  let json: string;
  try {
    const binary = atob(base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    json = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new InvalidCursorProblem("Cursor is not valid Base64");
  }

  let payload: unknown;
  try {
    payload = JSON.parse(json);
  } catch {
    throw new InvalidCursorProblem("Cursor payload is not valid JSON");
  }

  if (typeof payload !== "object" || payload === null) {
    throw new InvalidCursorProblem("Cursor payload is not an object");
  }

  const p = payload as Record<string, unknown>;

  if (!("v" in p) || typeof p.v !== "number") {
    throw new InvalidCursorProblem("Cursor payload missing version field");
  }

  if (!("id" in p) || typeof p.id !== "string") {
    throw new InvalidCursorProblem("Cursor payload missing id field");
  }

  if (p.v !== CURSOR_VERSION) {
    throw new InvalidCursorProblem(`Unsupported cursor version: ${p.v}`);
  }

  return p as CursorPayload;
}

function toPaddedBase64(cursor: string): string | undefined {
  if (!/^[A-Za-z0-9+/_-]*={0,2}$/.test(cursor)) {
    return undefined;
  }

  const paddingIndex = cursor.indexOf("=");
  const unpadded = paddingIndex === -1 ? cursor : cursor.slice(0, paddingIndex);
  const remainder = unpadded.length % 4;

  if (remainder === 1) {
    return undefined;
  }

  const requiredPadding = (4 - remainder) % 4;
  const existingPadding = cursor.length - unpadded.length;

  if (existingPadding !== 0 && existingPadding !== requiredPadding) {
    return undefined;
  }

  return `${unpadded.replace(/-/g, "+").replace(/_/g, "/")}${"=".repeat(requiredPadding)}`;
}
