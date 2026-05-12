import { CURSOR_VERSION } from "./constants";
import { InvalidCursorProblem } from "./problems";
import type { CursorPayload } from "./types";

/**
 * Encode a cursor payload to URL-safe Base64 string
 */
export function encodeCursor(payload: CursorPayload): string {
  const json = JSON.stringify(payload);
  return Buffer.from(json).toString("base64url");
}

/**
 * Decode a URL-safe Base64 cursor string to payload
 * @throws InvalidCursorProblem if cursor is invalid
 */
export function decodeCursor(cursor: string): CursorPayload {
  if (!cursor || typeof cursor !== "string") {
    throw new InvalidCursorProblem("Cursor is empty or not a string");
  }

  let json: string;
  try {
    json = Buffer.from(cursor, "base64url").toString("utf-8");
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
